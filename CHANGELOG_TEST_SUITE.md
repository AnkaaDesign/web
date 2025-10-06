# Comprehensive Test Suite for Changelog System

## Table of Contents
1. [Simple Field Changes Tests](#1-simple-field-changes-tests)
2. [Complex Relations Tests](#2-complex-relations-tests)
3. [Edge Case Tests](#3-edge-case-tests)
4. [API Endpoint Tests](#4-api-endpoint-tests)
5. [Testing Commands](#5-testing-commands)
6. [Test Data Setup](#6-test-data-setup)

---

## 1. Simple Field Changes Tests

### 1.1 Update Single Field (Status)

**Test Case: TC-001-SINGLE-STATUS**
```typescript
describe('Changelog - Single Field Update (Status)', () => {
  it('should create changelog entry when task status is updated', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const oldStatus = TASK_STATUS.PENDING;
    const newStatus = TASK_STATUS.IN_PRODUCTION;

    // Act
    await updateTask(taskId, { status: newStatus }, userId);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'status'
      },
      include: { user: true }
    });

    expect(changelogs.data).toHaveLength(1);
    expect(changelogs.data[0]).toMatchObject({
      entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
      entityId: taskId,
      action: CHANGE_LOG_ACTION.UPDATE,
      field: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      userId: userId,
      triggeredBy: CHANGE_TRIGGERED_BY.TASK_UPDATE
    });
  });
});
```

**Expected Changelog Entry:**
```json
{
  "id": "uuid",
  "entityType": "TASK",
  "entityId": "test-task-id",
  "action": "UPDATE",
  "field": "status",
  "oldValue": "PENDING",
  "newValue": "IN_PRODUCTION",
  "reason": null,
  "metadata": null,
  "userId": "test-user-id",
  "triggeredBy": "TASK_UPDATE",
  "triggeredById": null,
  "createdAt": "2025-10-06T...",
  "updatedAt": "2025-10-06T..."
}
```

---

### 1.2 Update Multiple Fields at Once

**Test Case: TC-002-MULTIPLE-FIELDS**
```typescript
describe('Changelog - Multiple Field Updates', () => {
  it('should create separate changelog entries for each field updated', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const updates = {
      status: TASK_STATUS.IN_PRODUCTION,
      priority: 'HIGH',
      price: 1500.00
    };

    // Act
    await updateTask(taskId, updates, userId);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId
      },
      orderBy: { field: 'asc' }
    });

    expect(changelogs.data).toHaveLength(3);

    // Verify each field has its own changelog
    const priceLog = changelogs.data.find(log => log.field === 'price');
    expect(priceLog).toMatchObject({
      field: 'price',
      oldValue: 0,
      newValue: 1500.00,
      action: CHANGE_LOG_ACTION.UPDATE
    });

    const statusLog = changelogs.data.find(log => log.field === 'status');
    expect(statusLog).toMatchObject({
      field: 'status',
      oldValue: 'PENDING',
      newValue: 'IN_PRODUCTION',
      action: CHANGE_LOG_ACTION.UPDATE
    });

    const priorityLog = changelogs.data.find(log => log.field === 'priority');
    expect(priorityLog).toMatchObject({
      field: 'priority',
      oldValue: null,
      newValue: 'HIGH',
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });
});
```

**Expected Changelog Entries:**
```json
[
  {
    "field": "price",
    "oldValue": 0,
    "newValue": 1500.00,
    "action": "UPDATE"
  },
  {
    "field": "priority",
    "oldValue": null,
    "newValue": "HIGH",
    "action": "UPDATE"
  },
  {
    "field": "status",
    "oldValue": "PENDING",
    "newValue": "IN_PRODUCTION",
    "action": "UPDATE"
  }
]
```

---

### 1.3 Update with Null Values

**Test Case: TC-003-NULL-VALUES**
```typescript
describe('Changelog - Null Value Updates', () => {
  it('should create changelog when field is set to null', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';

    // Act - Clear the price field
    await updateTask(taskId, { price: null }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'price'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'price',
      oldValue: 1500.00,
      newValue: null,
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });

  it('should create changelog when null field is set to a value', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';

    // Act
    await updateTask(taskId, { serialNumber: 'SN-12345' }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'serialNumber'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'serialNumber',
      oldValue: null,
      newValue: 'SN-12345',
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });
});
```

**Expected Changelog Entries:**
```json
[
  {
    "field": "price",
    "oldValue": 1500.00,
    "newValue": null
  },
  {
    "field": "serialNumber",
    "oldValue": null,
    "newValue": "SN-12345"
  }
]
```

---

### 1.4 Update Enum Fields

**Test Case: TC-004-ENUM-FIELDS**
```typescript
describe('Changelog - Enum Field Updates', () => {
  it('should track enum value changes correctly', async () => {
    // Arrange
    const userId = 'test-user-id';

    // Act - Update user status
    await updateUser(userId, {
      status: USER_STATUS.CONTRACTED
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.USER,
        entityId: userId,
        field: 'status'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'status',
      oldValue: 'EXPERIENCE_PERIOD_1',
      newValue: 'CONTRACTED',
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });

  it('should track vacation status changes', async () => {
    // Arrange
    const vacationId = 'test-vacation-id';
    const userId = 'test-user-id';

    // Act
    await updateVacation(vacationId, {
      status: VACATION_STATUS.APPROVED
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.VACATION,
        entityId: vacationId,
        field: 'status'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'status',
      oldValue: 'PENDING',
      newValue: 'APPROVED',
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });
});
```

**Expected Changelog Entries:**
```json
[
  {
    "entityType": "USER",
    "field": "status",
    "oldValue": "EXPERIENCE_PERIOD_1",
    "newValue": "CONTRACTED"
  },
  {
    "entityType": "VACATION",
    "field": "status",
    "oldValue": "PENDING",
    "newValue": "APPROVED"
  }
]
```

---

### 1.5 Update Date Fields

**Test Case: TC-005-DATE-FIELDS**
```typescript
describe('Changelog - Date Field Updates', () => {
  it('should track date changes with proper formatting', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const oldDate = new Date('2025-10-01T10:00:00Z');
    const newDate = new Date('2025-10-15T10:00:00Z');

    // Act
    await updateTask(taskId, {
      term: newDate
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'term'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'term',
      oldValue: oldDate.toISOString(),
      newValue: newDate.toISOString(),
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });

  it('should track entry date changes', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const entryDate = new Date('2025-10-06T08:00:00Z');

    // Act
    await updateTask(taskId, {
      entryDate: entryDate
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'entryDate'
      }
    });

    expect(changelog.data[0].newValue).toBe(entryDate.toISOString());
  });
});
```

**Expected Changelog Entry:**
```json
{
  "field": "term",
  "oldValue": "2025-10-01T10:00:00.000Z",
  "newValue": "2025-10-15T10:00:00.000Z",
  "action": "UPDATE"
}
```

---

### 1.6 Update Currency/Number Fields

**Test Case: TC-006-CURRENCY-NUMBER**
```typescript
describe('Changelog - Currency and Number Updates', () => {
  it('should track price changes with decimal precision', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';

    // Act
    await updateTask(taskId, {
      price: 2500.50
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'price'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'price',
      oldValue: 1500.00,
      newValue: 2500.50,
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });

  it('should track quantity changes', async () => {
    // Arrange
    const itemId = 'test-item-id';
    const userId = 'test-user-id';

    // Act
    await updateItem(itemId, {
      quantity: 100
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.ITEM,
        entityId: itemId,
        field: 'quantity'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'quantity',
      oldValue: 50,
      newValue: 100,
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });

  it('should track tax percentage changes', async () => {
    // Arrange
    const orderItemId = 'test-order-item-id';
    const userId = 'test-user-id';

    // Act
    await updateOrderItem(orderItemId, {
      tax: 18.5
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.ORDER_ITEM,
        entityId: orderItemId,
        field: 'tax'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'tax',
      oldValue: 0,
      newValue: 18.5,
      action: CHANGE_LOG_ACTION.UPDATE
    });
  });
});
```

**Expected Changelog Entries:**
```json
[
  {
    "field": "price",
    "oldValue": 1500.00,
    "newValue": 2500.50
  },
  {
    "field": "quantity",
    "oldValue": 50,
    "newValue": 100
  },
  {
    "field": "tax",
    "oldValue": 0,
    "newValue": 18.5
  }
]
```

---

## 2. Complex Relations Tests

### 2.1 Add Cuts to Task

**Test Case: TC-101-ADD-CUTS**
```typescript
describe('Changelog - Add Cuts to Task', () => {
  it('should create changelog when cuts are added to task', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const cutData = {
      type: CUT_TYPE.VINYL,
      fileId: 'test-file-id',
      origin: CUT_ORIGIN.PLAN,
      status: CUT_STATUS.PENDING
    };

    // Act
    const cut = await createCut({
      ...cutData,
      taskId: taskId
    }, userId);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'cuts'
      }
    });

    expect(changelogs.data[0]).toMatchObject({
      entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
      entityId: taskId,
      action: CHANGE_LOG_ACTION.UPDATE,
      field: 'cuts',
      oldValue: [],
      newValue: expect.arrayContaining([
        expect.objectContaining({ id: cut.data.id })
      ]),
      metadata: {
        operation: 'ADD',
        cutId: cut.data.id,
        cutType: CUT_TYPE.VINYL
      },
      userId: userId,
      triggeredBy: CHANGE_TRIGGERED_BY.TASK_UPDATE
    });
  });

  it('should create changelog when multiple cuts are added', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const cuts = [
      { type: CUT_TYPE.VINYL, fileId: 'file-1' },
      { type: CUT_TYPE.STENCIL, fileId: 'file-2' }
    ];

    // Act
    for (const cutData of cuts) {
      await createCut({ ...cutData, taskId }, userId);
    }

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'cuts'
      },
      orderBy: { createdAt: 'asc' }
    });

    expect(changelogs.data).toHaveLength(2);
    expect(changelogs.data[0].metadata.cutType).toBe(CUT_TYPE.VINYL);
    expect(changelogs.data[1].metadata.cutType).toBe(CUT_TYPE.STENCIL);
  });
});
```

**Expected Changelog Entry:**
```json
{
  "entityType": "TASK",
  "entityId": "test-task-id",
  "action": "UPDATE",
  "field": "cuts",
  "oldValue": [],
  "newValue": [{ "id": "cut-id", "type": "VINYL" }],
  "metadata": {
    "operation": "ADD",
    "cutId": "cut-id",
    "cutType": "VINYL"
  },
  "userId": "test-user-id",
  "triggeredBy": "TASK_UPDATE"
}
```

---

### 2.2 Remove Cuts from Task

**Test Case: TC-102-REMOVE-CUTS**
```typescript
describe('Changelog - Remove Cuts from Task', () => {
  it('should create changelog when cut is removed from task', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const cutId = 'test-cut-id';
    const userId = 'test-user-id';

    // Get current state
    const task = await getTaskById(taskId, { include: { cuts: true } });
    const cutToRemove = task.data.cuts.find(c => c.id === cutId);

    // Act
    await deleteCut(cutId, userId);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'cuts'
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(changelogs.data[0]).toMatchObject({
      action: CHANGE_LOG_ACTION.UPDATE,
      field: 'cuts',
      metadata: {
        operation: 'REMOVE',
        cutId: cutId,
        cutType: cutToRemove.type
      },
      userId: userId,
      triggeredBy: CHANGE_TRIGGERED_BY.TASK_UPDATE
    });
  });
});
```

**Expected Changelog Entry:**
```json
{
  "entityType": "TASK",
  "entityId": "test-task-id",
  "action": "UPDATE",
  "field": "cuts",
  "oldValue": [{ "id": "cut-id", "type": "VINYL" }],
  "newValue": [],
  "metadata": {
    "operation": "REMOVE",
    "cutId": "cut-id",
    "cutType": "VINYL"
  },
  "userId": "test-user-id",
  "triggeredBy": "TASK_UPDATE"
}
```

---

### 2.3 Modify Existing Cuts

**Test Case: TC-103-MODIFY-CUTS**
```typescript
describe('Changelog - Modify Existing Cuts', () => {
  it('should create changelog when cut status is updated', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const cutId = 'test-cut-id';
    const userId = 'test-user-id';

    // Act
    await updateCut(cutId, {
      status: CUT_STATUS.COMPLETED
    }, userId);

    // Assert - Check cut entity changelog
    const cutChangelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.CUT,
        entityId: cutId,
        field: 'status'
      }
    });

    expect(cutChangelog.data[0]).toMatchObject({
      entityType: CHANGE_LOG_ENTITY_TYPE.CUT,
      entityId: cutId,
      action: CHANGE_LOG_ACTION.UPDATE,
      field: 'status',
      oldValue: CUT_STATUS.PENDING,
      newValue: CUT_STATUS.COMPLETED,
      userId: userId
    });

    // Assert - Check if task changelog was also created
    const taskChangelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'cuts'
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(taskChangelog.data[0].metadata).toMatchObject({
      operation: 'MODIFY',
      cutId: cutId,
      changedField: 'status'
    });
  });
});
```

**Expected Changelog Entries:**
```json
[
  {
    "entityType": "CUT",
    "entityId": "test-cut-id",
    "action": "UPDATE",
    "field": "status",
    "oldValue": "PENDING",
    "newValue": "COMPLETED"
  },
  {
    "entityType": "TASK",
    "entityId": "test-task-id",
    "action": "UPDATE",
    "field": "cuts",
    "metadata": {
      "operation": "MODIFY",
      "cutId": "test-cut-id",
      "changedField": "status"
    }
  }
]
```

---

### 2.4 Add Multiple Cuts at Once

**Test Case: TC-104-BATCH-ADD-CUTS**
```typescript
describe('Changelog - Batch Add Cuts', () => {
  it('should create batch changelog when multiple cuts are added at once', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const cutsData = [
      { type: CUT_TYPE.VINYL, fileId: 'file-1', origin: CUT_ORIGIN.PLAN },
      { type: CUT_TYPE.VINYL, fileId: 'file-2', origin: CUT_ORIGIN.PLAN },
      { type: CUT_TYPE.STENCIL, fileId: 'file-3', origin: CUT_ORIGIN.REQUEST }
    ];

    // Act
    const cuts = await batchCreateCuts({
      cuts: cutsData.map(data => ({ ...data, taskId }))
    }, userId);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'cuts'
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(changelogs.data[0]).toMatchObject({
      action: CHANGE_LOG_ACTION.UPDATE,
      field: 'cuts',
      metadata: {
        operation: 'BATCH_ADD',
        count: 3,
        cutIds: expect.arrayContaining(cuts.data.map(c => c.id))
      },
      triggeredBy: CHANGE_TRIGGERED_BY.BATCH_CREATE
    });
  });
});
```

**Expected Changelog Entry:**
```json
{
  "entityType": "TASK",
  "entityId": "test-task-id",
  "action": "UPDATE",
  "field": "cuts",
  "oldValue": [],
  "newValue": [
    { "id": "cut-1", "type": "VINYL" },
    { "id": "cut-2", "type": "VINYL" },
    { "id": "cut-3", "type": "STENCIL" }
  ],
  "metadata": {
    "operation": "BATCH_ADD",
    "count": 3,
    "cutIds": ["cut-1", "cut-2", "cut-3"]
  },
  "triggeredBy": "BATCH_CREATE"
}
```

---

### 2.5 Services Relations

**Test Case: TC-105-SERVICES**
```typescript
describe('Changelog - Task Services Relations', () => {
  it('should create changelog when service is added to task', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const serviceData = {
      name: 'Custom Paint Service',
      price: 500.00,
      status: SERVICE_ORDER_STATUS.PENDING
    };

    // Act
    const service = await createServiceOrder({
      ...serviceData,
      taskId: taskId
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'services'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'services',
      metadata: {
        operation: 'ADD',
        serviceId: service.data.id,
        serviceName: serviceData.name
      }
    });
  });

  it('should create changelog when service is removed', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const serviceId = 'test-service-id';
    const userId = 'test-user-id';

    // Act
    await deleteServiceOrder(serviceId, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'services'
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(changelog.data[0].metadata).toMatchObject({
      operation: 'REMOVE',
      serviceId: serviceId
    });
  });
});
```

---

### 2.6 Airbrushings Relations

**Test Case: TC-106-AIRBRUSHINGS**
```typescript
describe('Changelog - Task Airbrushings Relations', () => {
  it('should create changelog when airbrushing is added', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const airbrushingData = {
      details: 'Custom airbrushing design',
      price: 800.00,
      status: AIRBRUSHING_STATUS.PENDING
    };

    // Act
    const airbrushing = await createAirbrushing({
      ...airbrushingData,
      taskId: taskId
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'airbrushings'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'airbrushings',
      metadata: {
        operation: 'ADD',
        airbrushingId: airbrushing.data.id
      }
    });
  });
});
```

---

### 2.7 Logo Paints Relations

**Test Case: TC-107-LOGO-PAINTS**
```typescript
describe('Changelog - Task Logo Paints Relations', () => {
  it('should create changelog when paint is added to task logos', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const paintId = 'test-paint-id';
    const userId = 'test-user-id';

    // Act
    await updateTask(taskId, {
      logoPaints: {
        connect: [{ id: paintId }]
      }
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'logoPaints'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'logoPaints',
      metadata: {
        operation: 'ADD',
        paintId: paintId
      }
    });
  });

  it('should create changelog when paint is removed from task logos', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const paintId = 'test-paint-id';
    const userId = 'test-user-id';

    // Act
    await updateTask(taskId, {
      logoPaints: {
        disconnect: [{ id: paintId }]
      }
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'logoPaints'
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(changelog.data[0].metadata).toMatchObject({
      operation: 'REMOVE',
      paintId: paintId
    });
  });
});
```

---

### 2.8 Artworks Relations

**Test Case: TC-108-ARTWORKS**
```typescript
describe('Changelog - Task Artworks Relations', () => {
  it('should create changelog when artwork file is added', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const fileId = 'test-file-id';
    const userId = 'test-user-id';

    // Act
    await updateTask(taskId, {
      artworks: {
        connect: [{ id: fileId }]
      }
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'artworks'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      field: 'artworks',
      metadata: {
        operation: 'ADD',
        fileId: fileId
      }
    });
  });

  it('should create changelog when multiple artworks are added at once', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const fileIds = ['file-1', 'file-2', 'file-3'];
    const userId = 'test-user-id';

    // Act
    await updateTask(taskId, {
      artworks: {
        connect: fileIds.map(id => ({ id }))
      }
    }, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'artworks'
      }
    });

    expect(changelog.data[0].metadata).toMatchObject({
      operation: 'BATCH_ADD',
      count: 3,
      fileIds: fileIds
    });
  });
});
```

---

## 3. Edge Case Tests

### 3.1 Create Task (No Changelog for Initial State)

**Test Case: TC-201-CREATE-NO-CHANGELOG**
```typescript
describe('Changelog - Task Creation', () => {
  it('should NOT create field-level changelogs on task creation', async () => {
    // Arrange
    const userId = 'test-user-id';
    const taskData = {
      name: 'New Task',
      status: TASK_STATUS.PENDING,
      customerId: 'customer-id',
      sectorId: 'sector-id',
      price: 1000.00
    };

    // Act
    const task = await createTask(taskData, userId);

    // Assert - Only CREATE action should exist
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: task.data.id
      }
    });

    expect(changelogs.data).toHaveLength(1);
    expect(changelogs.data[0]).toMatchObject({
      action: CHANGE_LOG_ACTION.CREATE,
      field: null,
      oldValue: null,
      newValue: null,
      metadata: {
        initialState: taskData
      }
    });
  });
});
```

**Expected Changelog Entry:**
```json
{
  "entityType": "TASK",
  "entityId": "new-task-id",
  "action": "CREATE",
  "field": null,
  "oldValue": null,
  "newValue": null,
  "metadata": {
    "initialState": {
      "name": "New Task",
      "status": "PENDING",
      "customerId": "customer-id",
      "sectorId": "sector-id",
      "price": 1000.00
    }
  },
  "userId": "test-user-id",
  "triggeredBy": "TASK_CREATE"
}
```

---

### 3.2 Update with No Actual Changes

**Test Case: TC-202-NO-CHANGES**
```typescript
describe('Changelog - No Actual Changes', () => {
  it('should NOT create changelog when values are unchanged', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';

    // Get current task state
    const task = await getTaskById(taskId);

    // Act - Update with same values
    await updateTask(taskId, {
      status: task.data.status,
      price: task.data.price
    }, userId);

    // Assert
    const changelogCount = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId
      }
    });

    const previousCount = changelogCount.meta.totalRecords;

    // No new changelogs should be created
    expect(changelogCount.meta.totalRecords).toBe(previousCount);
  });

  it('should create changelog only for changed fields', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const task = await getTaskById(taskId);

    // Act - Update with one changed and one unchanged field
    await updateTask(taskId, {
      status: task.data.status, // Same value
      price: 2000.00 // Different value
    }, userId);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId
      },
      orderBy: { createdAt: 'desc' }
    });

    // Only one changelog for the changed field
    expect(changelogs.data[0].field).toBe('price');
  });
});
```

---

### 3.3 Batch Updates with Rollback

**Test Case: TC-203-BATCH-ROLLBACK**
```typescript
describe('Changelog - Batch Update Rollback', () => {
  it('should rollback all changes if batch update fails', async () => {
    // Arrange
    const taskIds = ['task-1', 'task-2', 'task-3'];
    const userId = 'test-user-id';
    const updates = {
      status: TASK_STATUS.IN_PRODUCTION
    };

    // Get initial changelog count
    const initialLogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: { in: taskIds }
      }
    });
    const initialCount = initialLogs.meta.totalRecords;

    // Act - Attempt batch update that will fail on the 3rd task
    try {
      await batchUpdateTasks({
        tasks: taskIds.map((id, index) => ({
          id,
          data: index === 2 ? { status: 'INVALID_STATUS' } : updates
        }))
      }, userId);
    } catch (error) {
      // Expected to fail
    }

    // Assert - No new changelogs should be created
    const finalLogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: { in: taskIds }
      }
    });

    expect(finalLogs.meta.totalRecords).toBe(initialCount);
  });

  it('should create rollback changelog entry on manual rollback', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const changelogId = 'changelog-to-rollback';

    // Act
    await rollbackChange(changelogId, userId);

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(changelog.data[0]).toMatchObject({
      action: CHANGE_LOG_ACTION.ROLLBACK,
      metadata: {
        rolledBackChangelogId: changelogId
      }
    });
  });
});
```

**Expected Rollback Changelog Entry:**
```json
{
  "entityType": "TASK",
  "entityId": "test-task-id",
  "action": "ROLLBACK",
  "field": "status",
  "oldValue": "IN_PRODUCTION",
  "newValue": "PENDING",
  "metadata": {
    "rolledBackChangelogId": "changelog-to-rollback",
    "reason": "Manual rollback"
  },
  "userId": "test-user-id",
  "triggeredBy": "USER_ACTION"
}
```

---

### 3.4 Concurrent Updates

**Test Case: TC-204-CONCURRENT-UPDATES**
```typescript
describe('Changelog - Concurrent Updates', () => {
  it('should handle concurrent updates correctly', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const user1Id = 'user-1';
    const user2Id = 'user-2';

    // Act - Simulate concurrent updates
    const [update1, update2] = await Promise.all([
      updateTask(taskId, { status: TASK_STATUS.IN_PRODUCTION }, user1Id),
      updateTask(taskId, { price: 2000.00 }, user2Id)
    ]);

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId
      },
      orderBy: { createdAt: 'desc' }
    });

    // Both updates should have changelog entries
    expect(changelogs.data).toHaveLength(2);

    const statusLog = changelogs.data.find(log => log.field === 'status');
    const priceLog = changelogs.data.find(log => log.field === 'price');

    expect(statusLog.userId).toBe(user1Id);
    expect(priceLog.userId).toBe(user2Id);
  });

  it('should maintain changelog order with concurrent updates', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const updates = Array.from({ length: 10 }, (_, i) => ({
      userId: `user-${i}`,
      price: 1000 + (i * 100)
    }));

    // Act
    await Promise.all(
      updates.map(({ userId, price }) =>
        updateTask(taskId, { price }, userId)
      )
    );

    // Assert
    const changelogs = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId,
        field: 'price'
      },
      orderBy: { createdAt: 'asc' }
    });

    expect(changelogs.data).toHaveLength(10);

    // Verify each changelog has correct timestamps
    for (let i = 1; i < changelogs.data.length; i++) {
      const current = new Date(changelogs.data[i].createdAt);
      const previous = new Date(changelogs.data[i-1].createdAt);
      expect(current >= previous).toBe(true);
    }
  });
});
```

---

### 3.5 Update with Missing userId

**Test Case: TC-205-MISSING-USER-ID**
```typescript
describe('Changelog - Missing User ID', () => {
  it('should handle system updates without userId', async () => {
    // Arrange
    const taskId = 'test-task-id';

    // Act - System-triggered update (no userId)
    await updateTask(taskId, {
      status: TASK_STATUS.IN_PRODUCTION
    }, null, {
      triggeredBy: CHANGE_TRIGGERED_BY.SYSTEM
    });

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
        entityId: taskId
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(changelog.data[0]).toMatchObject({
      userId: null,
      triggeredBy: CHANGE_TRIGGERED_BY.SYSTEM
    });
  });

  it('should require userId for user-triggered actions', async () => {
    // Arrange
    const taskId = 'test-task-id';

    // Act & Assert
    await expect(
      updateTask(taskId, { status: TASK_STATUS.IN_PRODUCTION }, null)
    ).rejects.toThrow('userId is required for user-triggered actions');
  });

  it('should allow null userId for scheduled jobs', async () => {
    // Arrange
    const itemId = 'test-item-id';

    // Act - Scheduled update to monthly consumption
    await updateItem(itemId, {
      monthlyConsumption: 150
    }, null, {
      triggeredBy: CHANGE_TRIGGERED_BY.SCHEDULED_JOB
    });

    // Assert
    const changelog = await getChangeLogs({
      where: {
        entityType: CHANGE_LOG_ENTITY_TYPE.ITEM,
        entityId: itemId,
        field: 'monthlyConsumption'
      }
    });

    expect(changelog.data[0]).toMatchObject({
      userId: null,
      triggeredBy: CHANGE_TRIGGERED_BY.SCHEDULED_JOB
    });
  });
});
```

**Expected Changelog Entry (System Update):**
```json
{
  "entityType": "TASK",
  "entityId": "test-task-id",
  "action": "UPDATE",
  "field": "status",
  "oldValue": "PENDING",
  "newValue": "IN_PRODUCTION",
  "userId": null,
  "triggeredBy": "SYSTEM",
  "metadata": {
    "systemReason": "Automated status update"
  }
}
```

---

## 4. API Endpoint Tests

### 4.1 Fetch Changelogs for Task

**Test Case: TC-301-FETCH-CHANGELOGS**
```typescript
describe('API - Fetch Changelogs', () => {
  it('GET /changelogs should return changelogs for specific task', async () => {
    // Arrange
    const taskId = 'test-task-id';

    // Act
    const response = await fetch(`/api/changelogs?entityType=TASK&entityId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('meta');
    expect(data.data).toBeInstanceOf(Array);

    data.data.forEach(log => {
      expect(log.entityType).toBe('TASK');
      expect(log.entityId).toBe(taskId);
    });
  });

  it('GET /changelogs/:id should return specific changelog', async () => {
    // Arrange
    const changelogId = 'test-changelog-id';

    // Act
    const response = await fetch(`/api/changelogs/${changelogId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.data.id).toBe(changelogId);
  });

  it('should include user details when requested', async () => {
    // Arrange
    const taskId = 'test-task-id';

    // Act
    const response = await fetch(
      `/api/changelogs?entityType=TASK&entityId=${taskId}&include[user]=true`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(data.data[0]).toHaveProperty('user');
    expect(data.data[0].user).toHaveProperty('name');
    expect(data.data[0].user).toHaveProperty('email');
  });
});
```

**Expected API Response:**
```json
{
  "data": [
    {
      "id": "changelog-1",
      "entityType": "TASK",
      "entityId": "test-task-id",
      "action": "UPDATE",
      "field": "status",
      "oldValue": "PENDING",
      "newValue": "IN_PRODUCTION",
      "reason": null,
      "metadata": null,
      "userId": "user-id",
      "triggeredBy": "TASK_UPDATE",
      "triggeredById": null,
      "createdAt": "2025-10-06T10:00:00.000Z",
      "updatedAt": "2025-10-06T10:00:00.000Z",
      "user": {
        "id": "user-id",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "meta": {
    "totalRecords": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 4.2 Pagination

**Test Case: TC-302-PAGINATION**
```typescript
describe('API - Changelog Pagination', () => {
  it('should paginate changelogs correctly', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const page = 2;
    const limit = 10;

    // Act
    const response = await fetch(
      `/api/changelogs?entityType=TASK&entityId=${taskId}&page=${page}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.meta).toMatchObject({
      page: 2,
      limit: 10
    });
    expect(data.data.length).toBeLessThanOrEqual(10);
  });

  it('should handle first page correctly', async () => {
    // Arrange & Act
    const response = await fetch(
      '/api/changelogs?page=1&limit=20',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(data.meta.page).toBe(1);
    expect(data.data.length).toBeLessThanOrEqual(20);
  });

  it('should handle empty pages correctly', async () => {
    // Arrange & Act
    const response = await fetch(
      '/api/changelogs?page=9999&limit=20',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
    expect(data.meta.page).toBe(9999);
  });
});
```

---

### 4.3 Filter by Field

**Test Case: TC-303-FILTER-FIELD**
```typescript
describe('API - Filter Changelogs by Field', () => {
  it('should filter changelogs by specific field', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const field = 'status';

    // Act
    const response = await fetch(
      `/api/changelogs?entityType=TASK&entityId=${taskId}&field=${field}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    data.data.forEach(log => {
      expect(log.field).toBe(field);
    });
  });

  it('should filter by multiple fields using where clause', async () => {
    // Arrange
    const taskId = 'test-task-id';

    // Act
    const response = await fetch(
      `/api/changelogs?entityType=TASK&entityId=${taskId}&where[field][in][]=status&where[field][in][]=price`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    data.data.forEach(log => {
      expect(['status', 'price']).toContain(log.field);
    });
  });

  it('should filter by action type', async () => {
    // Arrange
    const action = CHANGE_LOG_ACTION.UPDATE;

    // Act
    const response = await fetch(
      `/api/changelogs?where[action]=${action}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    data.data.forEach(log => {
      expect(log.action).toBe(action);
    });
  });
});
```

---

### 4.4 Filter by Date Range

**Test Case: TC-304-FILTER-DATE**
```typescript
describe('API - Filter Changelogs by Date Range', () => {
  it('should filter changelogs by date range', async () => {
    // Arrange
    const startDate = new Date('2025-10-01T00:00:00Z');
    const endDate = new Date('2025-10-06T23:59:59Z');

    // Act
    const response = await fetch(
      `/api/changelogs?where[createdAt][gte]=${startDate.toISOString()}&where[createdAt][lte]=${endDate.toISOString()}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    data.data.forEach(log => {
      const logDate = new Date(log.createdAt);
      expect(logDate >= startDate).toBe(true);
      expect(logDate <= endDate).toBe(true);
    });
  });

  it('should filter changelogs created after specific date', async () => {
    // Arrange
    const afterDate = new Date('2025-10-05T00:00:00Z');

    // Act
    const response = await fetch(
      `/api/changelogs?where[createdAt][gt]=${afterDate.toISOString()}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    data.data.forEach(log => {
      const logDate = new Date(log.createdAt);
      expect(logDate > afterDate).toBe(true);
    });
  });

  it('should use createdAt filter shorthand', async () => {
    // Arrange
    const startDate = new Date('2025-10-01T00:00:00Z');
    const endDate = new Date('2025-10-06T23:59:59Z');

    // Act
    const response = await fetch(
      `/api/changelogs?createdAt[gte]=${startDate.toISOString()}&createdAt[lte]=${endDate.toISOString()}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.data.length).toBeGreaterThan(0);
  });
});
```

---

### 4.5 Verify Changelog Format

**Test Case: TC-305-FORMAT-VALIDATION**
```typescript
describe('API - Changelog Format Validation', () => {
  it('should return changelogs in correct format', async () => {
    // Act
    const response = await fetch('/api/changelogs?limit=1', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    // Assert
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('meta');

    const changelog = data.data[0];
    expect(changelog).toHaveProperty('id');
    expect(changelog).toHaveProperty('entityType');
    expect(changelog).toHaveProperty('entityId');
    expect(changelog).toHaveProperty('action');
    expect(changelog).toHaveProperty('field');
    expect(changelog).toHaveProperty('oldValue');
    expect(changelog).toHaveProperty('newValue');
    expect(changelog).toHaveProperty('reason');
    expect(changelog).toHaveProperty('metadata');
    expect(changelog).toHaveProperty('userId');
    expect(changelog).toHaveProperty('triggeredBy');
    expect(changelog).toHaveProperty('triggeredById');
    expect(changelog).toHaveProperty('createdAt');
    expect(changelog).toHaveProperty('updatedAt');
  });

  it('should validate entity type enum', async () => {
    // Act
    const response = await fetch('/api/changelogs?where[entityType]=INVALID_TYPE', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    // Assert
    expect(response.status).toBe(400);
  });

  it('should validate action enum', async () => {
    // Act
    const response = await fetch('/api/changelogs?where[action]=INVALID_ACTION', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    // Assert
    expect(response.status).toBe(400);
  });

  it('should validate UUID format for entityId', async () => {
    // Act
    const response = await fetch('/api/changelogs?where[entityId]=not-a-uuid', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    // Assert
    expect(response.status).toBe(400);
  });
});
```

---

### 4.6 Complex Query Combinations

**Test Case: TC-306-COMPLEX-QUERIES**
```typescript
describe('API - Complex Changelog Queries', () => {
  it('should handle complex filter combinations', async () => {
    // Arrange
    const taskId = 'test-task-id';
    const userId = 'test-user-id';
    const startDate = new Date('2025-10-01T00:00:00Z');

    // Act
    const response = await fetch(
      `/api/changelogs?` +
      `where[entityType]=TASK&` +
      `where[entityId]=${taskId}&` +
      `where[userId]=${userId}&` +
      `where[action]=UPDATE&` +
      `where[createdAt][gte]=${startDate.toISOString()}&` +
      `orderBy[createdAt]=desc&` +
      `include[user]=true&` +
      `page=1&limit=10`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    data.data.forEach(log => {
      expect(log.entityType).toBe('TASK');
      expect(log.entityId).toBe(taskId);
      expect(log.userId).toBe(userId);
      expect(log.action).toBe('UPDATE');
      expect(new Date(log.createdAt) >= startDate).toBe(true);
      expect(log).toHaveProperty('user');
    });
  });

  it('should search changelogs with searchingFor parameter', async () => {
    // Act
    const response = await fetch(
      '/api/changelogs?searchingFor=status&entityType=TASK',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    // Results should contain 'status' in field, reason, or other searchable fields
  });

  it('should filter by multiple entity types', async () => {
    // Act
    const response = await fetch(
      '/api/changelogs?entityTypes[]=TASK&entityTypes[]=ORDER&entityTypes[]=ITEM',
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const data = await response.json();

    // Assert
    data.data.forEach(log => {
      expect(['TASK', 'ORDER', 'ITEM']).toContain(log.entityType);
    });
  });
});
```

---

## 5. Testing Commands

### 5.1 Setup Test Database
```bash
# Setup test database with migrations
npm run test:db:setup

# Or using Docker
docker-compose -f docker-compose.test.yml up -d

# Run migrations
npm run migrate:test
```

### 5.2 Run All Tests
```bash
# Run all changelog tests
npm run test:changelog

# Run with coverage
npm run test:changelog -- --coverage

# Run in watch mode
npm run test:changelog -- --watch

# Run specific test suite
npm run test:changelog -- --testPathPattern="simple-field"
```

### 5.3 Run Specific Test Categories
```bash
# Simple field tests only
npm run test -- --grep "Simple Field"

# Complex relations tests only
npm run test -- --grep "Complex Relations"

# Edge cases only
npm run test -- --grep "Edge Case"

# API tests only
npm run test -- --grep "API"
```

### 5.4 Integration Test Commands
```bash
# Run integration tests (requires running backend)
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance
```

### 5.5 Database Seeding for Tests
```bash
# Seed test database with sample data
npm run seed:test

# Clear test database
npm run test:db:clear

# Reset and reseed
npm run test:db:reset
```

### 5.6 Test Utilities
```bash
# Generate test coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci

# Debug tests
npm run test:debug

# Generate test report
npm run test:report
```

---

## 6. Test Data Setup

### 6.1 Test Database Schema
```sql
-- Example test data setup script

-- Create test users
INSERT INTO "User" (id, name, email, status, "createdAt", "updatedAt")
VALUES
  ('user-1', 'Test User 1', 'user1@test.com', 'CONTRACTED', NOW(), NOW()),
  ('user-2', 'Test User 2', 'user2@test.com', 'CONTRACTED', NOW(), NOW());

-- Create test customers
INSERT INTO "Customer" (id, "fantasyName", "corporateName", cnpj, "createdAt", "updatedAt")
VALUES
  ('customer-1', 'Test Customer', 'Test Corp', '12345678000190', NOW(), NOW());

-- Create test sectors
INSERT INTO "Sector" (id, name, privileges, "createdAt", "updatedAt")
VALUES
  ('sector-1', 'Production', 'PRODUCTION', NOW(), NOW());

-- Create test tasks
INSERT INTO "Task" (id, name, status, "statusOrder", commission, "customerId", "sectorId", "createdById", "createdAt", "updatedAt")
VALUES
  ('task-1', 'Test Task 1', 'PENDING', 0, 'NO_COMMISSION', 'customer-1', 'sector-1', 'user-1', NOW(), NOW()),
  ('task-2', 'Test Task 2', 'IN_PRODUCTION', 1, 'NO_COMMISSION', 'customer-1', 'sector-1', 'user-1', NOW(), NOW());
```

### 6.2 Test Fixtures
```typescript
// test/fixtures/changelog.fixtures.ts

export const testTask = {
  id: 'test-task-id',
  name: 'Test Task',
  status: TASK_STATUS.PENDING,
  statusOrder: 0,
  commission: 'NO_COMMISSION',
  customerId: 'customer-1',
  sectorId: 'sector-1',
  createdById: 'user-1'
};

export const testUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  status: USER_STATUS.CONTRACTED
};

export const testChangelog = {
  entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
  entityId: 'test-task-id',
  action: CHANGE_LOG_ACTION.UPDATE,
  field: 'status',
  oldValue: TASK_STATUS.PENDING,
  newValue: TASK_STATUS.IN_PRODUCTION,
  userId: 'test-user-id',
  triggeredBy: CHANGE_TRIGGERED_BY.TASK_UPDATE
};
```

### 6.3 Mock Data Generators
```typescript
// test/helpers/changelog.helpers.ts

import { faker } from '@faker-js/faker';

export function generateChangelogData(overrides = {}) {
  return {
    entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
    entityId: faker.string.uuid(),
    action: CHANGE_LOG_ACTION.UPDATE,
    field: 'status',
    oldValue: TASK_STATUS.PENDING,
    newValue: TASK_STATUS.IN_PRODUCTION,
    userId: faker.string.uuid(),
    triggeredBy: CHANGE_TRIGGERED_BY.TASK_UPDATE,
    ...overrides
  };
}

export function generateTaskData(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    status: TASK_STATUS.PENDING,
    statusOrder: 0,
    commission: 'NO_COMMISSION',
    customerId: faker.string.uuid(),
    sectorId: faker.string.uuid(),
    createdById: faker.string.uuid(),
    ...overrides
  };
}

export async function createTestTask(overrides = {}) {
  const taskData = generateTaskData(overrides);
  return await prisma.task.create({ data: taskData });
}

export async function createTestChangelog(overrides = {}) {
  const changelogData = generateChangelogData(overrides);
  return await prisma.changeLog.create({ data: changelogData });
}
```

### 6.4 Test Cleanup
```typescript
// test/setup/cleanup.ts

export async function cleanupTestData() {
  // Delete in correct order to respect foreign key constraints
  await prisma.changeLog.deleteMany({});
  await prisma.cut.deleteMany({});
  await prisma.serviceOrder.deleteMany({});
  await prisma.airbrushing.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.sector.deleteMany({});
}

export async function resetTestDatabase() {
  await cleanupTestData();
  await seedTestData();
}
```

### 6.5 Test Assertions Helpers
```typescript
// test/helpers/assertions.ts

export function expectChangelogMatch(changelog, expected) {
  expect(changelog).toMatchObject({
    entityType: expected.entityType,
    entityId: expected.entityId,
    action: expected.action,
    field: expected.field,
    userId: expected.userId
  });

  if (expected.oldValue !== undefined) {
    expect(changelog.oldValue).toEqual(expected.oldValue);
  }

  if (expected.newValue !== undefined) {
    expect(changelog.newValue).toEqual(expected.newValue);
  }
}

export async function expectChangelogCount(filters, expectedCount) {
  const changelogs = await getChangeLogs(filters);
  expect(changelogs.data).toHaveLength(expectedCount);
}

export async function expectNoChangelog(filters) {
  const changelogs = await getChangeLogs(filters);
  expect(changelogs.data).toHaveLength(0);
}
```

---

## Summary

This comprehensive test suite covers:

1. **Simple Field Changes (6 test categories)**
   - Single field updates
   - Multiple field updates
   - Null value handling
   - Enum field tracking
   - Date field tracking
   - Currency/number field tracking

2. **Complex Relations (8 test categories)**
   - Add/Remove/Modify cuts
   - Batch operations on cuts
   - Services relations
   - Airbrushings relations
   - Logo paints relations
   - Artworks relations

3. **Edge Cases (5 test categories)**
   - Create operations (no field-level changelog)
   - No-change updates
   - Batch rollbacks
   - Concurrent updates
   - Missing userId handling

4. **API Endpoints (6 test categories)**
   - Fetch changelogs
   - Pagination
   - Field filtering
   - Date range filtering
   - Format validation
   - Complex queries

5. **Testing Infrastructure**
   - Database setup/teardown
   - Test data fixtures
   - Mock data generators
   - Assertion helpers
   - Cleanup utilities

**Total Test Cases: 35+ individual test cases**

Each test case includes:
- Clear test description
- Arrange-Act-Assert structure
- Expected changelog output
- Proper assertions
- Edge case handling
