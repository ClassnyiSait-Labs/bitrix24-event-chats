<?php

use Bitrix\Main\Loader;
use Bitrix\Main\Page\Asset;
use Bitrix\Main\Web\Json;

$moduleId = 'classnyisait.notifychat';

// Определяем веб-путь к модулю
$webModuleDir = (is_dir($_SERVER['DOCUMENT_ROOT'] . '/local/modules/' . $moduleId))
    ? '/local/modules/' . $moduleId
    : '/bitrix/modules/' . $moduleId;

// Автозагрузка классов
Loader::registerAutoLoadClasses($moduleId, [
    'Classnyisait\NotifyChat\NotifyChat' => 'lib/NotifyChat.php',
    'Classnyisait\NotifyChat\EventRegistrar' => 'lib/EventRegistrar.php',
    'Classnyisait\NotifyChat\EventHandler' => 'lib/EventHandler.php',
]);

// Подключение JS — отключено после обновления Bitrix24 v26 (2026-05-04).
// См. подробное описание причины в local/modules/classnyisait.crmchat/include.php.
// TODO: переписать под Vue plugin/Vuex после готовности приложения чата.
$asset = Asset::getInstance();
$notifyDialogIds = [];
$userId = (int)\Bitrix\Main\Engine\CurrentUser::get()->getId();
if ($userId > 0) {
    $notifyDialogIds = \Classnyisait\NotifyChat\NotifyChat::getUserNotifyDialogIds($userId);
}
$asset->addString(
    '<script>window.classnyisaitNotifyDialogIds = ' . Json::encode($notifyDialogIds) . ';</script>'
);
$notifyScript = $webModuleDir . '/install/js/v26_notify_ui.js';
$notifyFile = $_SERVER['DOCUMENT_ROOT'] . $notifyScript;
$asset->addString(
    '<script src="' . $notifyScript . '?v=' . filemtime($notifyFile) . '"></script>'
);
//$asset->addJs($webModuleDir . '/install/js/fix_navigation.js');
//$asset->addJs($webModuleDir . '/install/js/notify_chat_filter.js');

?>
