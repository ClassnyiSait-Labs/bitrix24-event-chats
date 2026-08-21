<?php
IncludeModuleLangFile(__FILE__);
use Bitrix\Main\ModuleManager;
use Bitrix\Main\EventManager;

class classnyisait_notifychat extends CModule
{
    var $MODULE_ID = "classnyisait.notifychat";
    var $MODULE_VERSION;
    var $MODULE_VERSION_DATE;
    var $MODULE_NAME;
    var $MODULE_DESCRIPTION;

    public function __construct()
    {
        $arModuleVersion = [];
        include(__DIR__ . "/version.php");

        $this->MODULE_VERSION      = $arModuleVersion["VERSION"];
        $this->MODULE_VERSION_DATE = $arModuleVersion["VERSION_DATE"];
        $this->MODULE_NAME         = "Чаты событий";
        $this->MODULE_DESCRIPTION  = "Вкладка \"Чаты событий\" в мессенджере Bitrix24. Работает только на веб-версии (коробочная редакция).";
        $this->PARTNER_NAME        = "ClassnyiSait";
        $this->PARTNER_URI         = "https://classnyisait.ru";
    }

    function DoInstall()
    {
        ModuleManager::registerModule($this->MODULE_ID);
        $this->InstallEvents();
        return true;
    }

    function DoUninstall()
    {
        $this->UnInstallEvents();
        ModuleManager::unRegisterModule($this->MODULE_ID);
    }

    function InstallEvents()
    {
        $eventManager = EventManager::getInstance();
        $eventManager->registerEventHandler("main", "OnProlog",                   $this->MODULE_ID, "\\Classnyisait\\NotifyChat\\EventHandler", "onProlog");
        $eventManager->registerEventHandler("im",   "OnAfterNavigationMenuBuild", $this->MODULE_ID, "\\Classnyisait\\NotifyChat\\NotifyChat",   "onNavigationMenuBuild");
    }

    function UnInstallEvents()
    {
        $eventManager = EventManager::getInstance();
        $eventManager->unRegisterEventHandler("main", "OnProlog",                   $this->MODULE_ID, "\\Classnyisait\\NotifyChat\\EventHandler", "onProlog");
        $eventManager->unRegisterEventHandler("im",   "OnAfterNavigationMenuBuild", $this->MODULE_ID, "\\Classnyisait\\NotifyChat\\NotifyChat",   "onNavigationMenuBuild");
    }
}
