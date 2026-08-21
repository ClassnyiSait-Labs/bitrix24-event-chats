/**
 * classnyisait.notifychat - DOM fallback for Bitrix24 v26.
 */
(function () {
	'use strict';

	var MENU_ID = 'notifyChat';

	function normalizeLayoutName(name) {
		if (!name || typeof name !== 'string') return '';
		var lower = name.toLowerCase();
		if (lower === 'notifychat') return MENU_ID;
		return name;
	}

	function getActiveNavigationLayoutName() {
		var selectors = [
			'#chat-menu .main-buttons-item',
			'#top_menu_id_collaboration .main-buttons-item'
		];
		for (var i = 0; i < selectors.length; i++) {
			var items = document.querySelectorAll(selectors[i]);
			for (var j = 0; j < items.length; j++) {
				var item = items[j];
				var cls = item.className || '';
				if (cls.indexOf('active') !== -1 || cls.indexOf('--active') !== -1) {
					return normalizeLayoutName(item.dataset && item.dataset.id || '');
				}
			}
		}
		return '';
	}

	function getKnownNotifyDialogIds() {
		var ids = window.classnyisaitNotifyDialogIds;
		return Array.isArray(ids) ? ids.map(String) : [];
	}

	function isNotifyDialog(dialogId) {
		var did = String(dialogId);
		if (getKnownNotifyDialogIds().indexOf(did) !== -1) return true;

		try {
			var store = BX.Messenger.v2.Application.Core.getStore();
			var chat = store && store.getters && store.getters['chats/get'] && store.getters['chats/get'](did);
			return !!(chat && (chat.type === 'sonetGroup' || chat.type === 'calendar'));
		} catch (e) {}
		return false;
	}

	function isHiddenByOtherFilter(item) {
		return item.dataset.crmChatHidden === '1' || item.dataset.chatCatHidden === '1';
	}

	function applyNotifyVisibility(item, visible) {
		if (visible) {
			delete item.dataset.notifyChatHidden;
			item.style.display = isHiddenByOtherFilter(item) ? 'none' : '';
		} else {
			item.dataset.notifyChatHidden = '1';
			item.style.display = 'none';
		}
	}

	function maintainNotifyFilter() {
		var layoutName = getActiveNavigationLayoutName();
		var isNotifyTab = layoutName === MENU_ID;
		var isCommonChatTab = layoutName === 'chat';
		var items = document.querySelectorAll('.bx-im-list-recent-item__wrap[data-id]');

		if (!isNotifyTab && !isCommonChatTab) {
			items.forEach(function (item) {
				if (item.dataset.notifyChatHidden === '1') {
					delete item.dataset.notifyChatHidden;
					item.style.display = isHiddenByOtherFilter(item) ? 'none' : '';
				}
			});
			return;
		}

		var knownIds = getKnownNotifyDialogIds();
		if (isNotifyTab && knownIds.length === 0) return;

		items.forEach(function (item) {
			var isNotify = isNotifyDialog(item.dataset.id);
			var visible = isNotifyTab ? isNotify : !isNotify;
			applyNotifyVisibility(item, visible);
		});
	}

	function start() {
		maintainNotifyFilter();

		var attempts = 0;
		var pollId = setInterval(function () {
			attempts++;
			maintainNotifyFilter();
			if (attempts > 600) clearInterval(pollId);
		}, 50);

		try {
			var obs = new MutationObserver(maintainNotifyFilter);
			obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-id'] });
		} catch (e) {}
		try {
			document.addEventListener('click', function () {
				setTimeout(maintainNotifyFilter, 0);
				setTimeout(maintainNotifyFilter, 150);
			}, true);
		} catch (e) {}

	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();