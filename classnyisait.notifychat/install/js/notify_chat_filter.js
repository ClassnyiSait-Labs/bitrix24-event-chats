/**
 * custom.notifychat — event chat filter service
 *
 * When messenger layout is 'notifyChat':
 * - Shows sonetGroup and calendar chats (already in Vuex store)
 * - No REST loading needed — these chats load as part of the regular recent list
 *
 * For the regular 'chat' layout:
 * - Filters OUT sonetGroup and calendar chats
 *
 * Two-phase approach (mirrors fix_navigation.js):
 * Phase 1 (immediate): property trap on BX.Messenger.v2.Application.Core
 *   → wraps store._actions['recent/setRecent'] to cache dialogId→chatType
 *     from the raw payload (before formatFields strips chat.type)
 *   → wraps store._mutations['recent/setRecentCollection'] to filter out
 *     notify dialogIds using the type cache (zero-flash approach)
 * Phase 2 (interval): patch LegacyRecentService.getCollection + cleanup safety net
 *
 * Why action patch? state.recent.collection uses recentFieldsConfig which only
 * keeps dialogId/messageId/draft/pinned/etc — chat.type is NOT preserved.
 * The raw chat.type is only available in the recent/setRecent action payload.
 *
 * Auto-selects first chat when switching to notifyChat layout.
 */
(function () {
	'use strict';

	var NOTIFY_CHAT_TYPES = ['sonetGroup', 'calendar'];
	var LAYOUT_NAME = 'notifyChat';

	// Cache of dialogId → raw chat.type captured from recent/setRecent payload
	var dialogTypeCache = {};

	var state = {
		patched: false,
		actionPatched: false,
		mutationPatched: false,
	};

	function log(msg) {
		if (window.LB_DEBUG) { try { console.log('[NotifyChat] ' + msg); } catch (e) {} }
	}

	function isNotifyChatType(type) {
		return NOTIFY_CHAT_TYPES.indexOf(type) !== -1;
	}

	function ensureNamespace(path) {
		var parts = path.split('.');
		var obj = window;
		for (var i = 0; i < parts.length; i++) {
			obj[parts[i]] = obj[parts[i]] || {};
			obj = obj[parts[i]];
		}
		return obj;
	}

	function getStore() {
		try {
			var core = BX.Messenger.v2.Application.Core;
			return core && typeof core.getStore === 'function' ? core.getStore() : null;
		} catch (e) {
			return null;
		}
	}

	function getLayoutManager() {
		try {
			var lm = BX.Messenger.v2.Lib.LayoutManager.getInstance();
			return lm && typeof lm.setLayout === 'function' ? lm : null;
		} catch (e) {
			return null;
		}
	}

	function getCurrentLayoutName() {
		var store = getStore();
		if (!store) return '';
		var layout = store.state.application && store.state.application.layout;
		return layout ? layout.name : '';
	}

	// Returns recent items that belong to notifyChat (sonetGroup or calendar types)
	function getNotifyCollection(store) {
		var collection = store.state.recent && store.state.recent.collection
			? store.state.recent.collection
			: {};
		var result = [];

		Object.keys(collection).forEach(function (dialogId) {
			var dialog = store.getters['chats/get'](dialogId);
			if (dialog && isNotifyChatType(dialog.type)) {
				result.push(collection[dialogId]);
			}
		});

		return result;
	}

	// =========================================================
	// Phase 1a: Action patch — capture chat.type from raw payload
	// recent/setRecent payload has full item data (with item.chat.type)
	// BEFORE formatFields strips it down to dialogId/messageId/etc.
	// =========================================================

	function installActionPatch(store) {
		if (state.actionPatched) return true;

		var handlers = store._actions && store._actions['recent/setRecent'];
		if (!handlers || !handlers.length) return false;

		var original = handlers[0];
		handlers[0] = function (payload) {
			// Synchronously cache dialogId → chatType before async chain starts
			if (Array.isArray(payload)) {
				payload.forEach(function (item) {
					var dialogId = item.id || item.dialogId;
					var chatType = item.chat && item.chat.type;
					if (dialogId && chatType) {
						dialogTypeCache[dialogId] = chatType;
					}
				});
			}
			return original(payload);
		};

		state.actionPatched = true;
		log('Action patch installed');
		return true;
	}

	// =========================================================
	// Phase 1b: Mutation patch — filter notify chats from
	// recentCollection before they are added (zero-flash approach)
	// =========================================================

	function installMutationPatch(store) {
		if (state.mutationPatched) return true;

		var handlers = store._mutations && store._mutations['recent/setRecentCollection'];
		if (!handlers || !handlers.length) return false;

		var original = handlers[0];
		handlers[0] = function (payload) {
			var filtered = payload.filter(function (dialogId) {
				// Primary: type cache captured from recent/setRecent action payload
				var cachedType = dialogTypeCache[dialogId];
				if (cachedType && isNotifyChatType(cachedType)) return false;

				// Fallback: chats model (available if chats/set completed first)
				try {
					var dialog = store.getters['chats/get'] && store.getters['chats/get'](dialogId);
					if (dialog && isNotifyChatType(dialog.type)) return false;
				} catch (e) {}

				return true;
			});
			return original(filtered);
		};

		state.mutationPatched = true;
		log('Mutation patch installed');
		return true;
	}

	function tryInstallPatches(coreRef) {
		var store = coreRef && coreRef.getStore && coreRef.getStore();
		if (!store) return;

		if (!state.actionPatched) installActionPatch(store);

		if (!state.mutationPatched) {
			if (!installMutationPatch(store)) {
				// Mutations not registered yet — poll until they are
				var tries = 0;
				var pollId = setInterval(function () {
					tries++;
					var s = coreRef && coreRef.getStore && coreRef.getStore();
					if ((s && installMutationPatch(s)) || tries > 150) {
						clearInterval(pollId);
					}
				}, 20);
			}
		}
	}

	// =========================================================
	// Core trap — intercept Core assignment to install patches ASAP
	// =========================================================

	function setupCoreTrap() {
		ensureNamespace('BX.Messenger.v2.Application');
		var app = BX.Messenger.v2.Application;

		// Core already set — install patches immediately
		if (app.Core) {
			tryInstallPatches(app.Core);
			return;
		}

		// Trap Core assignment — chain with any existing trap
		var prevDescriptor = Object.getOwnPropertyDescriptor(app, 'Core');
		var prevSetter = prevDescriptor && prevDescriptor.set;
		var origCore;
		Object.defineProperty(app, 'Core', {
			get: function () { return origCore; },
			set: function (val) {
				origCore = val;
				if (prevSetter) prevSetter(val);
				tryInstallPatches(val);
			},
			configurable: true,
			enumerable: true,
		});

		log('Core trap installed');
	}

	// =========================================================
	// Safety net: remove any notify chats already in recentCollection
	// =========================================================

	function cleanNotifyFromRecentCollection(store) {
		var recentCollection = store.state.recent && store.state.recent.recentCollection;
		if (!recentCollection) return;
		var toDelete = [];
		recentCollection.forEach(function (dialogId) {
			// At this point chats/set has completed, so chats/get is reliable
			var dialog = store.getters['chats/get'](dialogId);
			if (dialog && isNotifyChatType(dialog.type)) {
				toDelete.push(dialogId);
			}
		});
		toDelete.forEach(function (dialogId) {
			recentCollection.delete(dialogId);
		});
		log('cleanNotifyFromRecentCollection: removed ' + toDelete.length + ' items');
	}

	// =========================================================
	// Phase 2: LegacyRecentService patch (getCollection override)
	// =========================================================

	function patchService(LegacyRecentService) {
		var originalGetCollection = LegacyRecentService.prototype.getCollection;
		var originalLoadNextPage = LegacyRecentService.prototype.loadNextPage;

		LegacyRecentService.prototype.getCollection = function () {
			var layout = getCurrentLayoutName();

			if (layout === LAYOUT_NAME) {
				var store = getStore();
				if (store) {
					return getNotifyCollection(store);
				}
			}

			var result = originalGetCollection.call(this);

			// Filter out sonetGroup/calendar chats from the regular chat list
			if (layout === 'chat') {
				var store = getStore();
				if (store) {
					return result.filter(function (item) {
						var dialog = store.getters['chats/get'](item.dialogId);
						return !dialog || !isNotifyChatType(dialog.type);
					});
				}
			}

			return result;
		};

		// No additional pages to load for notifyChat — all items are already in the store
		LegacyRecentService.prototype.loadNextPage = function () {
			if (getCurrentLayoutName() === LAYOUT_NAME) {
				return Promise.resolve();
			}
			return originalLoadNextPage.call(this);
		};

		patchInstanceHasMore(LegacyRecentService);

		log('Patched LegacyRecentService');
		state.patched = true;
	}

	function patchInstanceHasMore(LegacyRecentService) {
		var instance = LegacyRecentService.getInstance();
		if (!instance) return;

		var origValue = instance.hasMoreItemsToLoad;
		Object.defineProperty(instance, 'hasMoreItemsToLoad', {
			get: function () {
				if (getCurrentLayoutName() === LAYOUT_NAME) {
					return false;
				}
				return origValue;
			},
			set: function (val) {
				origValue = val;
			},
			configurable: true,
		});
	}

	// =========================================================
	// Layout change watcher
	// =========================================================

	function watchLayout() {
		var store = getStore();
		if (!store) return;

		store.watch(
			function () {
				return store.state.application && store.state.application.layout;
			},
			function (newLayout) {
				if (!newLayout || newLayout.name !== LAYOUT_NAME) return;

				if (!newLayout.entityId) {
					autoSelectFirstChat();
				}
			},
			{ deep: true }
		);

		// Handle case when notifyChat layout is already active on load
		var currentLayout = store.state.application && store.state.application.layout;
		if (currentLayout && currentLayout.name === LAYOUT_NAME && !currentLayout.entityId) {
			autoSelectFirstChat();
		}
	}

	function autoSelectFirstChat() {
		var store = getStore();
		if (!store) return;

		var collection = getNotifyCollection(store);
		if (collection.length === 0) {
			log('autoSelect: no notifyChat chats');
			return;
		}

		// Sort by date descending
		collection.sort(function (a, b) {
			var dateA = store.getters['recent/getSortDate'](a.dialogId);
			var dateB = store.getters['recent/getSortDate'](b.dialogId);
			return (dateB || 0) - (dateA || 0);
		});

		var lm = getLayoutManager();
		if (lm) {
			log('autoSelect: selecting ' + collection[0].dialogId);
			lm.setLayout({ name: LAYOUT_NAME, entityId: collection[0].dialogId });
		}
	}

	// =========================================================
	// Badge counter for the "Чаты событий" navigation menu item
	// =========================================================

	function getChatMenus() {
		var menus = [];
		try {
			var manager = window.BX && BX.Main && BX.Main.interfaceButtonsManager;
			if (manager) {
				var m1 = manager.getById('chat-menu');
				var m2 = manager.getById('top_menu_id_collaboration');
				if (m1) { menus.push(m1); }
				if (m2) { menus.push(m2); }
			}
		} catch (e) {}
		return menus;
	}

	/**
	 * Recomputes the total unread count for notify chats (sonetGroup/calendar)
	 * and pushes it to the navigation badge via menu.updateCounter('notifyChat', N).
	 *
	 * Sources (in priority order):
	 *   1. store.state.chats.collection entries with type in NOTIFY_CHAT_TYPES
	 *      Updated by MessagePullHandler.#setMessageChat (type) + #updateDialog (counter).
	 *   2. dialogTypeCache — populated from recent/setRecent action patch.
	 *      sonetGroup/calendar ARE in im.v2.Recent.Load, so this cache is populated.
	 */
	function updateNotifyBadge() {
		var store = getStore();
		if (!store) { return; }

		var menus = getChatMenus();
		if (menus.length === 0) { return; }

		var totalCount = 0;
		var counted = {};
		var recentColl = store.state.recent && store.state.recent.collection;

		// Source 1: chats model — updated by PULL events via MessagePullHandler
		var chatsColl = store.state.chats && store.state.chats.collection;
		if (chatsColl) {
			Object.keys(chatsColl).forEach(function (dialogId) {
				var chat = chatsColl[dialogId];
				if (!chat || !isNotifyChatType(chat.type)) { return; }
				counted[dialogId] = true;
				if (chat.counter > 0) {
					totalCount += chat.counter;
				} else if (recentColl && recentColl[dialogId] && recentColl[dialogId].unread) {
					totalCount += 1;
				}
			});
		}

		// Source 2: dialogTypeCache — for items in recent.collection not yet in chats model
		Object.keys(dialogTypeCache).forEach(function (dialogId) {
			if (counted[dialogId]) { return; }
			if (!isNotifyChatType(dialogTypeCache[dialogId])) { return; }
			var chat = null;
			try { chat = store.getters['chats/get'] && store.getters['chats/get'](dialogId); } catch (e) {}
			if (chat && chat.counter > 0) {
				totalCount += chat.counter;
			} else if (recentColl && recentColl[dialogId] && recentColl[dialogId].unread) {
				totalCount += 1;
			}
		});

		menus.forEach(function (menu) {
			menu.updateCounter(LAYOUT_NAME, totalCount);
		});
		log('Badge updated: ' + totalCount + ' (chats: ' + Object.keys(counted).length + ')');
	}

	/**
	 * Subscribes to counter/recent changes and keeps the notifyChat badge in sync.
	 *
	 * Three triggers:
	 *   1. store.watch on chats.collection — PRIMARY TRIGGER.
	 *      PULL events update chats.collection via MessagePullHandler (type + counter).
	 *   2. store.watch on recent.collection.unread — backup for sonetGroup/calendar
	 *      which DO go through recent/setRecent on PULL (section='default').
	 *   3. IM.Counters:onUpdate — backup.
	 */
	function watchForBadgeUpdates(store) {
		// Trigger 1: watch chats.collection for sonetGroup/calendar counter changes
		try {
			store.watch(
				function (storeState) {
					var chatsColl = storeState.chats && storeState.chats.collection;
					if (!chatsColl) { return 0; }
					var total = 0;
					Object.keys(chatsColl).forEach(function (dialogId) {
						var chat = chatsColl[dialogId];
						if (chat && isNotifyChatType(chat.type) && chat.counter > 0) {
							total += chat.counter;
						}
					});
					return total;
				},
				function () { updateNotifyBadge(); }
			);
		} catch (e) {}

		// Trigger 2: watch recent.collection.unread for notify items
		// (sonetGroup/calendar use recent/setRecent on PULL → unread IS updated)
		try {
			store.watch(
				function (storeState) {
					var collection = storeState.recent && storeState.recent.collection;
					if (!collection) { return 0; }
					var count = 0;
					Object.keys(dialogTypeCache).forEach(function (dialogId) {
						if (!isNotifyChatType(dialogTypeCache[dialogId])) { return; }
						var item = collection[dialogId];
						if (item && item.unread) { count++; }
					});
					return count;
				},
				function () { updateNotifyBadge(); }
			);
		} catch (e) {}

		// Trigger 3: IM.Counters:onUpdate — backup
		try {
			var EventEmitter = window.BX && BX.Event && BX.Event.EventEmitter;
			if (EventEmitter) {
				EventEmitter.subscribe('IM.Counters:onUpdate', function () {
					setTimeout(updateNotifyBadge, 0);
				});
			}
		} catch (e) {}
	}

	// =========================================================
	// Init
	// =========================================================

	function initRuntimePatches() {
		// Fast poll: backup in case Core trap missed action/mutation install
		var fastId = setInterval(function () {
			if (state.actionPatched && state.mutationPatched) { clearInterval(fastId); return; }
			var store = getStore();
			if (!store) return;
			if (!state.actionPatched) installActionPatch(store);
			if (!state.mutationPatched) installMutationPatch(store);
			if (state.actionPatched && state.mutationPatched) clearInterval(fastId);
		}, 50);
		setTimeout(function () { clearInterval(fastId); }, 10000);

		// Slower poll: LegacyRecentService patch + cleanup safety net
		var intervalId = setInterval(function () {
			if (state.patched) { clearInterval(intervalId); return; }

			var Service = window.BX
				&& BX.Messenger
				&& BX.Messenger.v2
				&& BX.Messenger.v2.Service;
			var store = getStore();

			if (!Service || !Service.LegacyRecentService || !store) return;

			clearInterval(intervalId);
			patchService(Service.LegacyRecentService);
			cleanNotifyFromRecentCollection(store);
			watchLayout();
			watchForBadgeUpdates(store);
			updateNotifyBadge();
		}, 500);
	}

	// Phase 1: Set up Core trap IMMEDIATELY (before bundles assign Core)
	setupCoreTrap();

	// Phase 2: Wait for runtime objects, then patch
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initRuntimePatches);
	} else {
		initRuntimePatches();
	}
})();
