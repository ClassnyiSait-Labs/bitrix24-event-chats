<?php
if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED !== true) {
    die();
}
?>

<form action="<?= $APPLICATION->GetCurPage(); ?>">
    <?= bitrix_sessid_post(); ?>
    <input type="hidden" name="lang" value="<?= LANGUAGE_ID ?>">
    <input type="hidden" name="id" value="classnyisait.notifychat">

    <div class="adm-info-message-wrap adm-info-message-red">
        <div class="adm-info-message">
            <div class="adm-info-message-title">Модуль "Чаты событий" успешно удалён</div>
            <div class="adm-info-message-icon"></div>

            <p>Вкладка "Чаты событий" больше не будет отображаться в мессенджере.</p>
            <p>Файлы модуля остались в <code>/local/modules/custom.notifychat/</code> — можете удалить вручную.</p>
        </div>
    </div>

    <input type="submit" value="Вернуться в список модулей">
</form>
