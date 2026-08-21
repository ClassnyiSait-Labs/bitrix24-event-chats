<?php
namespace Classnyisait\NotifyChat;

use Bitrix\Im\V2\Application\Navigation\NavigationMenuBuildEvent;
use Bitrix\Im\V2\Application\Navigation\MenuItem;
use Bitrix\Main\EventResult;
use Bitrix\Main\Loader;

class NotifyChat
{
    const ENTITY_TYPES = ["SONET_GROUP", "CALENDAR"];

    public static function onNavigationMenuBuild(NavigationMenuBuildEvent $event): EventResult
    {
        $collection = $event->getCollection();
        $collection->add(new MenuItem(
            id: "notifyChat",
            text: "Чаты событий",
            sort: 200,
        ));

        return new EventResult(EventResult::SUCCESS);
    }

    public static function getTabSortForUser(int $userId): int
    {
        if ($userId <= 0) {
            return 200;
        }
        $saved = \CUserOptions::GetOption("classnyisait.chatcategories", "tab_sort_notifychat", 0, $userId);
        return $saved > 0 ? (int)$saved : 200;
    }

    public static function getUserNotifyDialogIds(int $userId): array
    {
        if ($userId <= 0 || !Loader::includeModule("im")) {
            return [];
        }

        $rows = \Bitrix\Im\Model\RecentTable::getList([
            "select" => ["ITEM_CID"],
            "filter" => [
                "=USER_ID"          => $userId,
                "@CHAT.ENTITY_TYPE" => self::ENTITY_TYPES,
            ],
        ])->fetchAll();

        return array_map(function ($row) {
            return "chat" . $row["ITEM_CID"];
        }, $rows);
    }
}
