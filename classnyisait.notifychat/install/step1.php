<?php
if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED !== true) {
    die();
}
?>

<form action="<?= $APPLICATION->GetCurPage(); ?>">
    <?= bitrix_sessid_post(); ?>
    <input type="hidden" name="lang" value="<?= LANGUAGE_ID ?>">
    <input type="hidden" name="id" value="classnyisait.notifychat">
    <input type="hidden" name="install" value="Y">
    <input type="hidden" name="step" value="2">

    <div class="adm-info-message-wrap adm-info-message-green">
        <div class="adm-info-message">
            <div class="adm-info-message-title">Модуль "Чаты событий" успешно установлен!</div>
            <div class="adm-info-message-icon"></div>

            <h3>Следующие шаги:</h3>
            <ol>
                <li>
                    <strong>Очистите кеши</strong><br>
                    Настройки → Производительность → Очистить кеш
                </li>
                <li>
                    <strong>Откройте мессенджер</strong> — должна появиться вкладка "Чаты событий"
                </li>
            </ol>

            <h3>Что делает модуль:</h3>
            <ul>
                <li>Добавляет вкладку "Чаты событий" в мессенджер (веб и мобиль)</li>
                <li>Собирает чаты групп (sonet_group) и событий календаря в отдельную вкладку</li>
                <li>Убирает эти чаты из основной вкладки "Чаты"</li>
                <li>Все файлы находятся в /local/modules/ и не затрутся при обновлении Битрикс</li>
            </ul>
        </div>
    </div>

    <input type="submit" value="Вернуться в список модулей">
</form>
