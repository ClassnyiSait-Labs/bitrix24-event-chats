<?php
namespace Classnyisait\NotifyChat;

use Bitrix\Main\Loader;

class EventHandler
{
    public static function onProlog(): void
    {
        Loader::includeModule("classnyisait.notifychat");
    }
}
