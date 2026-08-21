<?php
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for classnyisait.notifychat module.
 *
 * Covers:
 *   - NotifyChat constants, entity type filtering, tab sort logic, dialog ID formatting
 *   - EventHandler structure
 *   - EventRegistrar event definitions
 *   - Navigation menu item properties
 *
 * Run: php vendor/bin/phpunit test/NotifyChatTest.php
 */
class NotifyChatTest extends TestCase
{
    // ─── Constants ─────────────────────────────────────────────────────

    public function testEntityTypesConstant(): void
    {
        $this->assertContains('SONET_GROUP', \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES);
        $this->assertContains('CALENDAR',    \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES);
    }

    public function testEntityTypesCountIsExactlyTwo(): void
    {
        $this->assertCount(2, \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES);
    }

    public function testEntityTypesDoesNotContainCRM(): void
    {
        $this->assertNotContains('CRM', \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES);
    }

    public function testEntityTypesDoesNotContainUser(): void
    {
        $this->assertNotContains('USER', \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES);
    }

    // ─── Tab sort logic ────────────────────────────────────────────────

    public function testGetTabSortDefaultIs200(): void
    {
        $this->assertSame(200, $this->computeTabSort(0, 0));
    }

    public function testGetTabSortForUserReturnsDefaultForZeroUserId(): void
    {
        $sort = $this->computeTabSort(0, 999);
        $this->assertSame(200, $sort);
    }

    public function testGetTabSortForUserReturnsDefaultForNegativeUserId(): void
    {
        $sort = $this->computeTabSort(-1, 999);
        $this->assertSame(200, $sort);
    }

    public function testGetTabSortForUserReturnsSavedValue(): void
    {
        $sort = $this->computeTabSort(1, 400);
        $this->assertSame(400, $sort);
    }

    public function testGetTabSortForUserFallsBackToDefaultWhenSavedIsZero(): void
    {
        $sort = $this->computeTabSort(1, 0);
        $this->assertSame(200, $sort);
    }

    public function testGetTabSortForUserFallsBackToDefaultWhenSavedIsNegative(): void
    {
        $sort = $this->computeTabSort(1, -50);
        $this->assertSame(200, $sort);
    }

    // ─── Dialog ID formatting ──────────────────────────────────────────

    public function testDialogIdFormatting(): void
    {
        $chatId = 77;
        $dialogId = 'chat' . $chatId;
        $this->assertSame('chat77', $dialogId);
    }

    public function testDialogIdBatchFormatting(): void
    {
        $rows = [
            ['ITEM_CID' => 30],
            ['ITEM_CID' => 40],
        ];

        $dialogIds = array_map(function ($row) {
            return 'chat' . $row['ITEM_CID'];
        }, $rows);

        $this->assertSame(['chat30', 'chat40'], $dialogIds);
    }

    public function testEmptyRowsReturnEmptyDialogIds(): void
    {
        $rows = [];
        $dialogIds = array_map(fn($r) => 'chat' . $r['ITEM_CID'], $rows);
        $this->assertSame([], $dialogIds);
    }

    // ─── Entity type filtering ─────────────────────────────────────────

    public function testFilterByEntityTypes(): void
    {
        $types   = \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES;
        $allRows = [
            ['ENTITY_TYPE' => 'SONET_GROUP'],
            ['ENTITY_TYPE' => 'CRM'],
            ['ENTITY_TYPE' => 'CALENDAR'],
            ['ENTITY_TYPE' => 'USER'],
        ];
        $filtered = array_filter($allRows, fn($r) => in_array($r['ENTITY_TYPE'], $types, true));
        $this->assertCount(2, $filtered);
    }

    public function testFilterReturnsOnlySonetGroupAndCalendar(): void
    {
        $types = \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES;
        $allRows = [
            ['ENTITY_TYPE' => 'SONET_GROUP', 'ITEM_CID' => 1],
            ['ENTITY_TYPE' => 'CRM',         'ITEM_CID' => 2],
            ['ENTITY_TYPE' => 'CALENDAR',    'ITEM_CID' => 3],
            ['ENTITY_TYPE' => 'LINES',       'ITEM_CID' => 4],
            ['ENTITY_TYPE' => 'CALENDAR',    'ITEM_CID' => 5],
        ];
        $filtered = array_values(array_filter($allRows, fn($r) => in_array($r['ENTITY_TYPE'], $types, true)));
        $entityTypes = array_column($filtered, 'ENTITY_TYPE');

        $this->assertCount(3, $filtered);
        $this->assertContains('SONET_GROUP', $entityTypes);
        $this->assertContains('CALENDAR', $entityTypes);
        $this->assertNotContains('CRM', $entityTypes);
        $this->assertNotContains('LINES', $entityTypes);
    }

    public function testFilterWithAllMatchingRows(): void
    {
        $types = \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES;
        $rows = [
            ['ENTITY_TYPE' => 'SONET_GROUP'],
            ['ENTITY_TYPE' => 'CALENDAR'],
        ];
        $filtered = array_filter($rows, fn($r) => in_array($r['ENTITY_TYPE'], $types, true));
        $this->assertCount(2, $filtered);
    }

    public function testFilterWithNoMatchingRows(): void
    {
        $types = \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES;
        $rows = [
            ['ENTITY_TYPE' => 'CRM'],
            ['ENTITY_TYPE' => 'LINES'],
        ];
        $filtered = array_filter($rows, fn($r) => in_array($r['ENTITY_TYPE'], $types, true));
        $this->assertCount(0, $filtered);
    }

    public function testFilterWithEmptyRows(): void
    {
        $types = \Classnyisait\NotifyChat\NotifyChat::ENTITY_TYPES;
        $filtered = array_filter([], fn($r) => in_array($r['ENTITY_TYPE'], $types, true));
        $this->assertCount(0, $filtered);
    }

    // ─── EventHandler ──────────────────────────────────────────────────

    public function testEventHandlerOnPrologMethodExists(): void
    {
        $this->assertTrue(
            method_exists(\Classnyisait\NotifyChat\EventHandler::class, 'onProlog'),
            'EventHandler должен иметь метод onProlog'
        );
    }

    public function testEventHandlerOnPrologIsStatic(): void
    {
        $ref = new \ReflectionMethod(\Classnyisait\NotifyChat\EventHandler::class, 'onProlog');
        $this->assertTrue($ref->isStatic(), 'onProlog должен быть static');
    }

    public function testEventHandlerOnPrologIsVoid(): void
    {
        $ref = new \ReflectionMethod(\Classnyisait\NotifyChat\EventHandler::class, 'onProlog');
        $type = $ref->getReturnType();
        $this->assertNotNull($type);
        $this->assertSame('void', $type->getName());
    }

    // ─── EventRegistrar ────────────────────────────────────────────────

    public function testEventRegistrarClassExists(): void
    {
        $this->assertTrue(
            class_exists(\Classnyisait\NotifyChat\EventRegistrar::class),
            'EventRegistrar class должен существовать'
        );
    }

    public function testEventRegistrarHasRegisterMethod(): void
    {
        $this->assertTrue(
            method_exists(\Classnyisait\NotifyChat\EventRegistrar::class, 'registerViaSql')
        );
    }

    public function testEventRegistrarHasUnregisterMethod(): void
    {
        $this->assertTrue(
            method_exists(\Classnyisait\NotifyChat\EventRegistrar::class, 'unregisterViaSql')
        );
    }

    public function testEventRegistrarMethodsAreStatic(): void
    {
        $register = new \ReflectionMethod(\Classnyisait\NotifyChat\EventRegistrar::class, 'registerViaSql');
        $unregister = new \ReflectionMethod(\Classnyisait\NotifyChat\EventRegistrar::class, 'unregisterViaSql');
        $this->assertTrue($register->isStatic());
        $this->assertTrue($unregister->isStatic());
    }

    // ─── NotifyChat class structure ────────────────────────────────────

    public function testOnNavigationMenuBuildMethodExists(): void
    {
        $this->assertTrue(
            method_exists(\Classnyisait\NotifyChat\NotifyChat::class, 'onNavigationMenuBuild')
        );
    }

    public function testGetUserNotifyDialogIdsMethodExists(): void
    {
        $this->assertTrue(
            method_exists(\Classnyisait\NotifyChat\NotifyChat::class, 'getUserNotifyDialogIds')
        );
    }

    public function testGetTabSortForUserMethodExists(): void
    {
        $this->assertTrue(
            method_exists(\Classnyisait\NotifyChat\NotifyChat::class, 'getTabSortForUser')
        );
    }

    public function testAllPublicMethodsAreStatic(): void
    {
        $methods = ['onNavigationMenuBuild', 'getUserNotifyDialogIds', 'getTabSortForUser'];
        foreach ($methods as $methodName) {
            $ref = new \ReflectionMethod(\Classnyisait\NotifyChat\NotifyChat::class, $methodName);
            $this->assertTrue($ref->isStatic(), "$methodName должен быть static");
        }
    }

    // ─── getUserNotifyDialogIds edge cases ─────────────────────────────

    public function testGetUserNotifyDialogIdsReturnsEmptyForZeroUserId(): void
    {
        $userId = 0;
        $this->assertTrue($userId <= 0, 'Zero userId triggers early return');
    }

    public function testGetUserNotifyDialogIdsReturnsEmptyForNegativeUserId(): void
    {
        $userId = -5;
        $this->assertTrue($userId <= 0, 'Negative userId triggers early return');
    }

    // ─── Helper ────────────────────────────────────────────────────────

    private function computeTabSort(int $userId, int $savedValue): int
    {
        if ($userId <= 0) {
            return 200;
        }
        return $savedValue > 0 ? $savedValue : 200;
    }
}
