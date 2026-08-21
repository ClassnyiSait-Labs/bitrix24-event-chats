<?php
namespace Classnyisait\NotifyChat;

use Bitrix\Main\Application;

class EventRegistrar
{
    private static function buildEvents(): array
    {
        $docRoot    = rtrim($_SERVER["DOCUMENT_ROOT"], "/");
        $libWebPath = substr(__DIR__, strlen($docRoot));

        return [
            [
                "MODULE_ID"    => "im",
                "EVENT_NAME"   => "OnAfterNavigationMenuBuild",
                "TO_MODULE_ID" => "classnyisait.notifychat",
                "TO_CLASS"     => "\\Classnyisait\\NotifyChat\\NotifyChat",
                "TO_METHOD"    => "onNavigationMenuBuild",
                "TO_PATH"      => $libWebPath . "/NotifyChat.php",
            ],
        ];
    }

    public static function registerViaSql(): array
    {
        $result = ["success" => true, "registered" => 0, "errors" => []];

        try {
            $connection = Application::getConnection();

            foreach (self::buildEvents() as $event) {
                $h     = $connection->getSqlHelper();
                $check = $connection->query(
                    "SELECT COUNT(*) as cnt FROM b_event
                     WHERE MODULE_ID = '" . $h->forSql($event["MODULE_ID"]) . "'
                     AND EVENT_NAME = '" . $h->forSql($event["EVENT_NAME"]) . "'
                     AND TO_MODULE_ID = '" . $h->forSql($event["TO_MODULE_ID"]) . "'
                     AND TO_CLASS = '" . $h->forSql($event["TO_CLASS"]) . "'
                     AND TO_METHOD = '" . $h->forSql($event["TO_METHOD"]) . "'"
                )->fetch();

                if ($check["cnt"] > 0) {
                    continue;
                }

                $connection->query(
                    "INSERT INTO b_event (MODULE_ID, EVENT_NAME, TO_MODULE_ID, TO_CLASS, TO_METHOD, TO_PATH) VALUES (
                        '" . $h->forSql($event["MODULE_ID"]) . "',
                        '" . $h->forSql($event["EVENT_NAME"]) . "',
                        '" . $h->forSql($event["TO_MODULE_ID"]) . "',
                        '" . $h->forSql($event["TO_CLASS"]) . "',
                        '" . $h->forSql($event["TO_METHOD"]) . "',
                        '" . $h->forSql($event["TO_PATH"]) . "'
                    )"
                );
                $result["registered"]++;
            }
        } catch (\Exception $e) {
            $result["success"]   = false;
            $result["errors"][] = $e->getMessage();
        }

        return $result;
    }

    public static function unregisterViaSql(): array
    {
        $result = ["success" => true, "deleted" => 0, "errors" => []];

        try {
            $connection = Application::getConnection();
            $h = $connection->getSqlHelper();
            $r = $connection->query(
                "DELETE FROM b_event WHERE TO_MODULE_ID = '" . $h->forSql("classnyisait.notifychat") . "'
                 AND TO_CLASS = '" . $h->forSql("\\Classnyisait\\NotifyChat\\NotifyChat") . "'"
            );
            $result["deleted"] = $r->getAffectedRows();
        } catch (\Exception $e) {
            $result["success"]   = false;
            $result["errors"][] = $e->getMessage();
        }

        return $result;
    }
}
