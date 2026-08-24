<?php

use Bitrix\Main\Loader;
use Bitrix\Main\Page\Asset;
use Bitrix\Main\Web\Json;

$moduleId = 'classnyisait.notifychat';

// Publish JS under /bitrix/js (allowed). /bitrix/modules/ is often 403.
$publicJsDir = '/bitrix/js/classnyisait.notifychat';
$docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
$srcJsDir = __DIR__ . '/install/js';
if ($docRoot !== '' && is_dir($srcJsDir) && function_exists('CopyDirFiles')) {
    $dstJsDir = $docRoot . $publicJsDir;
    $needCopy = !is_dir($dstJsDir);
    if (!$needCopy) {
        foreach (scandir($srcJsDir) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $srcFile = $srcJsDir . '/' . $name;
            $dstFile = $dstJsDir . '/' . $name;
            if (is_file($srcFile) && (!is_file($dstFile) || filemtime($srcFile) > filemtime($dstFile))) {
                $needCopy = true;
                break;
            }
        }
    }
    if ($needCopy) {
        CopyDirFiles($srcJsDir, $dstJsDir, true, true);
    }
}

// Автозагрузка классов
Loader::registerAutoLoadClasses($moduleId, [
    'Classnyisait\NotifyChat\NotifyChat' => 'lib/NotifyChat.php',
    'Classnyisait\NotifyChat\EventRegistrar' => 'lib/EventRegistrar.php',
    'Classnyisait\NotifyChat\EventHandler' => 'lib/EventHandler.php',
]);

$asset = Asset::getInstance();
$notifyDialogIds = [];
$userId = (int)\Bitrix\Main\Engine\CurrentUser::get()->getId();
if ($userId > 0) {
    $notifyDialogIds = \Classnyisait\NotifyChat\NotifyChat::getUserNotifyDialogIds($userId);
}
$asset->addString(
    '<script>window.classnyisaitNotifyDialogIds = ' . Json::encode($notifyDialogIds) . ';</script>'
);
$notifyScript = $publicJsDir . '/v26_notify_ui.js';
$notifyFile = $docRoot . $notifyScript;
$asset->addString(
    '<script src="' . $notifyScript . (is_file($notifyFile) ? '?v=' . filemtime($notifyFile) : '') . '"></script>'
);
//$asset->addJs($publicJsDir . '/fix_navigation.js');
//$asset->addJs($publicJsDir . '/notify_chat_filter.js');
