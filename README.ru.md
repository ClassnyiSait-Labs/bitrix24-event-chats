# Чаты событий для Bitrix24

[English version](README.md) · [Лицензия MIT](LICENSE)

[![CI](https://github.com/ClassnyiSait-Labs/bitrix24-event-chats/actions/workflows/ci.yml/badge.svg)](https://github.com/ClassnyiSait-Labs/bitrix24-event-chats/actions/workflows/ci.yml) [![Latest release](https://img.shields.io/github/v/release/ClassnyiSait-Labs/bitrix24-event-chats?label=release)](https://github.com/ClassnyiSait-Labs/bitrix24-event-chats/releases/latest) [![PHP](https://img.shields.io/badge/PHP-8.1%2B-777bb4)](https://www.php.net/) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)


Бесплатный модуль с открытым исходным кодом для **коробочного Bitrix24**. Выделяет чаты
календарных событий в отдельную секцию мессенджера — так же, как это уже сделано для чатов задач.

![Секция чатов событий](docs/screenshots/01-overview.png)

## Зачем

Bitrix24 создаёт чат для каждого события календаря. Эти чаты падают в общий список Recent и
вытесняют вниз живые переписки. У чатов задач своя секция есть, у чатов событий — не было.
Модуль её добавляет.

## Возможности

- отдельная секция «Чаты событий» в списке Recent;
- поведение повторяет штатную секцию «Чаты задач»;
- ничего не заменяется — навигация мессенджера только дополняется.

## Требования

- коробочная редакция Bitrix24, версия 26.0 и выше
- веб-версия мессенджера

## Установка

1. Скопируйте папку `classnyisait.notifychat` в `/local/modules/` (или `/bitrix/modules/`).
2. **Marketplace → Установленные решения** → «Чаты событий» → *Установить*.
3. Перезагрузите мессенджер — секция «Чаты событий» появится в списке.

Страница модуля: <https://classnyisait.ru/modules/>

## Скриншоты

![Секция чатов событий в мессенджере](docs/screenshots/02-tab.jpg)

## Структура проекта

```
classnyisait.notifychat/
├── install/js/          интеграция в навигацию мессенджера и фильтр чатов событий
├── lib/NotifyChat.php   логика выборки чатов событий
├── lib/EventHandler.php, lib/EventRegistrar.php  подписка на события
└── test/                PHP-тесты
```

## Разработка

```bash
composer install
composer test          # 31 PHPUnit-тест
```

Тесты покрывают чистую логику, работающую без ядра Битрикса. Всё, что обращается к базе,
корзине или интерфейсу мессенджера, требует живого портала и проверяется вручную —
подробности в [CONTRIBUTING.md](CONTRIBUTING.md).

CI прогоняет линт и тесты на PHP 8.1, 8.2 и 8.3 при каждом push и pull request.

## Вклад в проект

Issues и pull requests приветствуются. При баг-репорте укажите номер сборки Bitrix24.

## Лицензия

MIT — см. [LICENSE](LICENSE).

Разработчик: [ClassnyiSait Labs](https://classnyisait.ru/) ·
[Поддержать разработчика](https://classnyisait.ru/support)
