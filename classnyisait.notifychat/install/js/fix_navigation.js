/**
 * custom.notifychat — runtime patches for notifyChat layout support
 *
 * All patches are applied at runtime so we don't depend on modified
 * bitrix bundles. This script MUST load before the messenger Vue app
 * is created (loaded via Asset::addString in OnBeforeProlog).
 *
 * Patches:
 * 1. Messenger component — listComponent/contentComponent for notifyChat
 * 2. LayoutManager — isValidLayout, isChatLayout, setLayout redirect
 * 3. NavigationManager — open() handler for notifyChat
 * 4. RecentListContainer — onChatClick preserves notifyChat layout
 * 5. RecentItem — isChatSelected includes notifyChat
 * 6. Menu active state fix
 * 7. Direct link support via ?IM_NOTIFYCHAT
 */
(function () {
	'use strict';

	var MENU_ID = 'notifyChat';
	var NOTIFY_CHAT_TYPES = ['sonetGroup', 'calendar'];
	var GET_PARAM = 'IM_NOTIFYCHAT';

	function log(msg) {
		if (window.LB_DEBUG) { try { console.log('[NotifyChat Nav] ' + msg); } catch (e) {} }
	}

	function isNotifyChatType(type) {
		return NOTIFY_CHAT_TYPES.indexOf(type) !== -1;
	}

	// =========================================================
	// 1. Patch Messenger component BEFORE Vue app compiles it
	// =========================================================

	function patchMessengerComponent() {
		ensureNamespace('BX.Messenger.v2.Component');

		var patched = false;
		var ns = BX.Messenger.v2.Component;
		var prevDescriptor = Object.getOwnPropertyDescriptor(ns, 'Messenger');
		var prevSetter = prevDescriptor && prevDescriptor.set;
		var origMessenger = ns.Messenger;

		Object.defineProperty(ns, 'Messenger', {
			get: function () {
				return origMessenger;
			},
			set: function (val) {
				origMessenger = val;
				if (prevSetter) {
					prevSetter(val);
				}
				if (val && val.computed && !patched) {
					patched = true;
					applyMessengerPatch(val);
				}
			},
			configurable: true,
			enumerable: true
		});

		if (origMessenger && origMessenger.computed && !patched) {
			patched = true;
			applyMessengerPatch(origMessenger);
		}
	}

	function applyMessengerPatch(comp) {
		var origList = comp.computed.listComponent;
		var origContent = comp.computed.contentComponent;
		function withChatLayout(self) {
			return new Proxy(self, {
				get: function (target, prop) {
					if (prop === 'layoutName') return 'chat';
					return target[prop];
				}
			});
		}

		comp.computed.listComponent = function () {
			try {
				var result = origList.call(this);
				if (result) return result;
			} catch (e) {}
			if (this.layoutName === MENU_ID) {
				try {
					return origList.call(withChatLayout(this));
				} catch (e2) {}
			}
			return origList.call(this);
		};

		comp.computed.contentComponent = function () {
			try {
				var result = origContent.call(this);
				if (result) return result;
			} catch (e) {}
			if (this.layoutName === MENU_ID) {
				try {
					return origContent.call(withChatLayout(this));
				} catch (e2) {}
			}
			return origContent.call(this);
		};

		log('Messenger component patched (listComponent/contentComponent)');
	}

	// =========================================================
	// 2. Patch RecentListContainer — preserve notifyChat on click
	// =========================================================

	function patchRecentListContainer() {
		ensureNamespace('BX.Messenger.v2.Component.List');

		var patched = false;
		var ns = BX.Messenger.v2.Component.List;
		var prevDescriptor = Object.getOwnPropertyDescriptor(ns, 'RecentListContainer');
		var prevSetter = prevDescriptor && prevDescriptor.set;
		var origComp = ns.RecentListContainer;

		Object.defineProperty(ns, 'RecentListContainer', {
			get: function () {
				return origComp;
			},
			set: function (val) {
				origComp = val;
				if (prevSetter) {
					prevSetter(val);
				}
				if (val && val.methods && !patched) {
					patched = true;
					applyRecentContainerPatch(val);
				}
			},
			configurable: true,
			enumerable: true
		});

		if (origComp && origComp.methods && !patched) {
			patched = true;
			applyRecentContainerPatch(origComp);
		}
	}

	function applyRecentContainerPatch(comp) {
		var origOnChatClick = comp.methods.onChatClick;

		comp.methods.onChatClick = function (dialogId) {
			var currentLayout = this.$store.state.application.layout.name;
			if (currentLayout === MENU_ID) {
				this.$emit('selectEntity', {
					layoutName: MENU_ID,
					entityId: dialogId
				});
				return;
			}
			return origOnChatClick.call(this, dialogId);
		};

		log('RecentListContainer patched (onChatClick)');
	}

	// =========================================================
	// 3. Patch RecentItem — isChatSelected includes notifyChat
	// =========================================================

	function patchRecentItem() {
		ensureNamespace('BX.Messenger.v2.Component.List');

		var patched = false;
		var ns = BX.Messenger.v2.Component.List;
		var prevDescriptor = Object.getOwnPropertyDescriptor(ns, 'RecentItem');
		var prevSetter = prevDescriptor && prevDescriptor.set;
		var origComp = ns.RecentItem;

		Object.defineProperty(ns, 'RecentItem', {
			get: function () {
				return origComp;
			},
			set: function (val) {
				origComp = val;
				if (prevSetter) {
					prevSetter(val);
				}
				if (val && val.computed && val.computed.isChatSelected && !patched) {
					patched = true;
					applyRecentItemPatch(val);
				}
			},
			configurable: true,
			enumerable: true
		});

		if (origComp && origComp.computed && origComp.computed.isChatSelected && !patched) {
			patched = true;
			applyRecentItemPatch(origComp);
		}
	}

	function applyRecentItemPatch(comp) {
		var origIsChatSelected = comp.computed.isChatSelected;

		comp.computed.isChatSelected = function () {
			if (this.layout && this.layout.name === MENU_ID) {
				return this.layout.entityId === this.recentItem.dialogId;
			}
			return origIsChatSelected.call(this);
		};

		log('RecentItem patched (isChatSelected)');
	}

	// =========================================================
	// 4. Patch LayoutManager — isValidLayout, isChatLayout, setLayout
	// =========================================================

	function patchLayoutManager() {
		var lib = getLib();
		if (!lib || !lib.LayoutManager) return false;

		var proto = lib.LayoutManager.prototype;

		if (!proto.__notifyChatPatched) {
			proto.__notifyChatPatched = true;

			var origIsValid = proto.isValidLayout;
			proto.isValidLayout = function (name) {
				if (name === MENU_ID) return true;
				return origIsValid.call(this, name);
			};

			var origIsChatLayout = proto.isChatLayout;
			proto.isChatLayout = function (name) {
				if (name === MENU_ID) return true;
				return origIsChatLayout.call(this, name);
			};

			// Redirect sonetGroup/calendar chats to notifyChat layout
			var origSetLayout = proto.setLayout;
			proto.setLayout = function (payload) {
				if (payload && payload.name !== MENU_ID && payload.entityId
				&& payload.name.indexOf('customCat_') !== 0) {
					try {
						var store = BX.Messenger.v2.Application.Core.getStore();
						if (store) {
							var dialog = store.getters['chats/get'](payload.entityId);
							if (dialog && isNotifyChatType(dialog.type)) {
								log('Redirecting ' + dialog.type + ' chat ' + payload.entityId + ' to notifyChat layout');
								payload = Object.assign({}, payload, { name: MENU_ID });
							}
						}
					} catch (e) {}
				}
				return origSetLayout.call(this, payload);
			};

			log('LayoutManager patched (isValidLayout, isChatLayout, setLayout)');
		}
		return true;
	}

	// =========================================================
	// 5. Patch NavigationManager.open — handle notifyChat click
	// =========================================================

	function patchNavigationManager() {
		var lib = getLib();
		if (!lib || !lib.NavigationManager) return false;

		var nm = lib.NavigationManager;
		if (nm.__notifyChatPatched) return true;
		nm.__notifyChatPatched = true;

		var origOpen = nm.open.bind(nm);
		nm.open = function (payload) {
			var payloadId = payload && typeof payload.id === 'string' ? payload.id.toLowerCase() : '';
			if (payloadId === MENU_ID.toLowerCase()) {
				log('NavigationManager.open intercepted for notifyChat');
				patchLayoutManager();
				var lm = getLayoutManager();
				if (lm) {
					var entityId = payload.entityId || '';
					if (!entityId && typeof lm.getLastOpenedElement === 'function') {
						entityId = lm.getLastOpenedElement(MENU_ID) || '';
					}
					lm.setLayout({ name: MENU_ID, entityId: entityId });
				}
				return;
			}
			return origOpen(payload);
		};

		log('NavigationManager patched (open)');
		return true;
	}

	// =========================================================
	// 6. Fix menu active state
	// =========================================================

	function initMenuFix() {
		try {
			var EventEmitter = BX.Event && BX.Event.EventEmitter;
			if (!EventEmitter) return false;

			EventEmitter.subscribe('IM.Layout:onLayoutChange', function (event) {
				var data = event.getData();
				if (!data || !data.to) return;

				var toName = data.to.name;
				var fromName = data.from ? data.from.name : '';

				if (toName === MENU_ID) {
					setTimeout(function () {
						var chatMenu = getChatMenu();
						if (chatMenu) {
							chatMenu.setActive(MENU_ID);
						}
					}, 0);
				}

				if (fromName === MENU_ID) {
					setTimeout(function () {
						var chatMenu = getChatMenu();
						if (chatMenu) {
							chatMenu.unsetActive(MENU_ID);
						}
					}, 0);
				}
			});

			log('Menu active state fix initialized');
			return true;
		} catch (e) {
			return false;
		}
	}

	// =========================================================
	// 7. Direct link support: /online/?IM_NOTIFYCHAT
	// =========================================================

	function handleDirectLink() {
		if (window.location.search.indexOf(GET_PARAM) === -1) return;

		log('GET param detected, will activate notifyChat on load');

		var tryActivate = function () {
			var lm = getLayoutManager();
			if (!lm) {
				setTimeout(tryActivate, 300);
				return;
			}
			patchLayoutManager();
			lm.setLayout({ name: MENU_ID, entityId: '' });
			log('notifyChat activated via direct link');
		};

		setTimeout(tryActivate, 500);
	}

	// =========================================================
	// Helpers
	// =========================================================

	function ensureNamespace(path) {
		var parts = path.split('.');
		var obj = window;
		for (var i = 0; i < parts.length; i++) {
			obj[parts[i]] = obj[parts[i]] || {};
			obj = obj[parts[i]];
		}
		return obj;
	}

	function getLib() {
		try {
			return BX.Messenger.v2.Lib;
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

	function getChatMenu() {
		try {
			var manager = BX.Main.interfaceButtonsManager;
			return manager ? manager.getById('chat-menu') : null;
		} catch (e) {
			return null;
		}
	}

	// =========================================================
	// Init
	// =========================================================

	// Phase 1: Set up property traps IMMEDIATELY (before bundles load)
	patchMessengerComponent();
	patchRecentListContainer();
	patchRecentItem();

	// Phase 2: Wait for runtime objects, then patch
	function initRuntimePatches() {
		var done = { lm: false, nm: false, menu: false };

		var intervalId = setInterval(function () {
			if (!done.lm) done.lm = patchLayoutManager();
			if (!done.nm) done.nm = patchNavigationManager();
			if (!done.menu) done.menu = initMenuFix();

			if (done.lm && done.nm && done.menu) {
				clearInterval(intervalId);
				log('All runtime patches applied');
			}
		}, 300);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			initRuntimePatches();
			handleDirectLink();
		});
	} else {
		initRuntimePatches();
		handleDirectLink();
	}
})();
