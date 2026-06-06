class TentAllocationStore {
  constructor() {
    this.specs = JSON.parse(JSON.stringify(TentSpecs));
    this.batches = JSON.parse(JSON.stringify(TentBatches));
    this.shelters = JSON.parse(JSON.stringify(Shelters));
    this.transportNodes = JSON.parse(JSON.stringify(TransportNodes));
    this.allocations = JSON.parse(JSON.stringify(AllocationRecords));
    this.warehouses = JSON.parse(JSON.stringify(Warehouses));
    this.currentView = 'command';
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l(this.getState()));
  }

  getState() {
    return {
      specs: this.specs,
      batches: this.batches,
      shelters: this.shelters,
      transportNodes: this.transportNodes,
      allocations: this.allocations,
      warehouses: this.warehouses,
      currentView: this.currentView
    };
  }

  setView(view) {
    this.currentView = view;
    this.notify();
  }

  getSpec(specId) {
    return this.specs.find(s => s.id === specId);
  }

  getBatch(batchId) {
    return this.batches.find(b => b.id === batchId);
  }

  getShelter(shelterId) {
    return this.shelters.find(s => s.id === shelterId);
  }

  getTotalInventoryBySpec(specId) {
    return this.batches
      .filter(b => b.specId === specId)
      .reduce((sum, b) => sum + b.availableQty + b.lockedQty, 0);
  }

  getAvailableInventoryBySpec(specId) {
    return this.batches
      .filter(b => b.specId === specId)
      .reduce((sum, b) => sum + b.availableQty, 0);
  }

  getShelterCapacityUsed(shelterId) {
    const shelter = this.getShelter(shelterId);
    if (!shelter) return 0;
    let totalCapacity = 0;
    for (const [specId, qty] of Object.entries(shelter.assignedTents)) {
      const spec = this.getSpec(specId);
      if (spec) {
        totalCapacity += spec.capacity * qty;
      }
    }
    return totalCapacity;
  }

  getShelterGap(shelterId) {
    const shelter = this.getShelter(shelterId);
    if (!shelter) return 0;
    const capacityProvided = this.getShelterCapacityUsed(shelterId);
    const gap = shelter.currentPopulation - capacityProvided;
    return Math.max(0, gap);
  }

  calculateShelterGapWithNewAllocation(shelterId, newAllocations) {
    const shelter = this.getShelter(shelterId);
    if (!shelter) return 0;
    
    const tempAssigned = { ...shelter.assignedTents };
    for (const [specId, qty] of Object.entries(newAllocations)) {
      tempAssigned[specId] = (tempAssigned[specId] || 0) + qty;
    }
    
    let totalCapacity = 0;
    for (const [specId, qty] of Object.entries(tempAssigned)) {
      const spec = this.getSpec(specId);
      if (spec) {
        totalCapacity += spec.capacity * qty;
      }
    }
    
    return Math.max(0, shelter.currentPopulation - totalCapacity);
  }

  checkCapacityOverflow(shelterId, newAllocations) {
    const shelter = this.getShelter(shelterId);
    if (!shelter) return { overflow: 0, canFit: true, suggestion: null };
    
    const additionalCapacity = Object.entries(newAllocations).reduce((sum, [specId, qty]) => {
      const spec = this.getSpec(specId);
      return sum + (spec ? spec.capacity * qty : 0);
    }, 0);
    
    const newPopulation = shelter.currentPopulation;
    const newCapacity = this.getShelterCapacityUsed(shelterId) + additionalCapacity;
    const overflow = newPopulation - newCapacity;
    
    if (overflow <= 0) {
      return { overflow: 0, canFit: true, suggestion: null };
    }
    
    const suggestion = this.generateSplitSuggestion(shelterId, overflow, newAllocations);
    return { overflow, canFit: false, suggestion };
  }

  generateSplitSuggestion(shelterId, overflowPeople, newAllocations) {
    const shelter = this.getShelter(shelterId);
    const suggestions = [];
    
    for (const [specId, reqQty] of Object.entries(newAllocations)) {
      const spec = this.getSpec(specId);
      if (!spec) continue;
      
      const tentsNeededForOverflow = Math.ceil(overflowPeople / spec.capacity);
      const reduceQty = Math.min(tentsNeededForOverflow, reqQty);
      
      if (reduceQty > 0) {
        suggestions.push({
          specId,
          specName: spec.name,
          reduceQty,
          reducedCapacity: reduceQty * spec.capacity,
          message: `建议减少 ${reduceQty} 顶 ${spec.name}，可减少 ${reduceQty * spec.capacity} 人容量占用`
        });
      }
    }
    
    return suggestions;
  }

  canSplitBatch(batchId) {
    const batch = this.getBatch(batchId);
    if (!batch) return false;
    if (batch.status === 'shipped') return false;
    return batch.availableQty > 0;
  }

  canReallocateAllocation(allocationId) {
    const allocation = this.allocations.find(a => a.id === allocationId);
    if (!allocation) return false;
    return allocation.status === 'locked';
  }

  allocateTents(batchId, shelterId, qty) {
    const batch = this.getBatch(batchId);
    const shelter = this.getShelter(shelterId);
    
    if (!batch || !shelter) {
      return { success: false, error: '批次或安置点不存在' };
    }
    
    if (!this.canSplitBatch(batchId)) {
      return { success: false, error: '该批次不可拆分（已发运或无可用库存）' };
    }
    
    if (batch.availableQty < qty) {
      return { success: false, error: `库存不足，可用数量：${batch.availableQty}` };
    }
    
    const capacityCheck = this.checkCapacityOverflow(shelterId, { [batch.specId]: qty });
    if (!capacityCheck.canFit) {
      return {
        success: false,
        error: `安置点容量不足，超出 ${capacityCheck.overflow} 人`,
        suggestions: capacityCheck.suggestion
      };
    }
    
    batch.availableQty -= qty;
    batch.lockedQty += qty;
    
    const allocationId = 'ALLOC-' + String(this.allocations.length + 1).padStart(3, '0');
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    this.allocations.push({
      id: allocationId,
      batchId: batch.id,
      shelterId: shelter.id,
      specId: batch.specId,
      qty: qty,
      status: 'locked',
      createTime: now,
      shipTime: null,
      transportNode: this.getDefaultTransportNode(batch.warehouse, shelter.id),
      operator: this.getOperator()
    });
    
    this.recalculateAllGaps();
    this.notify();
    
    return { success: true, allocationId };
  }

  getDefaultTransportNode(warehouseId, shelterId) {
    const warehouseTransportMap = {
      'WH-A01': 'NODE-04',
      'WH-B02': 'NODE-06',
      'WH-C03': 'NODE-05'
    };
    return warehouseTransportMap[warehouseId] || 'NODE-04';
  }

  getOperator() {
    const operators = {
      'warehouse': '仓库-管理员',
      'shelter': '安置点-管理员',
      'command': '指挥部-指挥员'
    };
    return operators[this.currentView] || '系统-操作';
  }

  cancelAllocation(allocationId) {
    const allocation = this.allocations.find(a => a.id === allocationId);
    if (!allocation) {
      return { success: false, error: '分配记录不存在' };
    }
    
    if (allocation.status !== 'locked') {
      return { success: false, error: '仅可撤销锁定状态（未发运）的分配' };
    }
    
    const batch = this.getBatch(allocation.batchId);
    if (batch) {
      batch.lockedQty -= allocation.qty;
      batch.availableQty += allocation.qty;
    }
    
    allocation.status = 'cancelled';
    allocation.cancelTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    this.recalculateAllGaps();
    this.notify();
    
    return { success: true };
  }

  shipAllocation(allocationId) {
    const allocation = this.allocations.find(a => a.id === allocationId);
    if (!allocation) {
      return { success: false, error: '分配记录不存在' };
    }
    
    if (allocation.status !== 'locked') {
      return { success: false, error: '仅可发运锁定状态的分配' };
    }
    
    const batch = this.getBatch(allocation.batchId);
    if (batch) {
      batch.lockedQty -= allocation.qty;
      batch.shippedQty += allocation.qty;
    }
    
    const shelter = this.getShelter(allocation.shelterId);
    if (shelter) {
      shelter.assignedTents[allocation.specId] = 
        (shelter.assignedTents[allocation.specId] || 0) + allocation.qty;
    }
    
    allocation.status = 'in_transit';
    allocation.shipTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    this.recalculateAllGaps();
    this.notify();
    
    return { success: true };
  }

  confirmDelivery(allocationId) {
    const allocation = this.allocations.find(a => a.id === allocationId);
    if (!allocation) {
      return { success: false, error: '分配记录不存在' };
    }
    
    if (allocation.status !== 'in_transit') {
      return { success: false, error: '仅可确认运输中状态的分配' };
    }
    
    allocation.status = 'delivered';
    allocation.deliveryTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    this.notify();
    return { success: true };
  }

  reallocateAllocation(allocationId, newShelterId) {
    const allocation = this.allocations.find(a => a.id === allocationId);
    if (!allocation) {
      return { success: false, error: '分配记录不存在' };
    }
    
    if (allocation.status !== 'locked') {
      return { success: false, error: '仅可改派锁定状态（未发运）的分配' };
    }
    
    const oldShelter = this.getShelter(allocation.shelterId);
    const newShelter = this.getShelter(newShelterId);
    if (!newShelter) {
      return { success: false, error: '目标安置点不存在' };
    }
    
    const capacityCheck = this.checkCapacityOverflow(newShelterId, { [allocation.specId]: allocation.qty });
    if (!capacityCheck.canFit) {
      return {
        success: false,
        error: `目标安置点容量不足，超出 ${capacityCheck.overflow} 人`,
        suggestions: capacityCheck.suggestion
      };
    }
    
    allocation.shelterId = newShelterId;
    allocation.transportNode = this.getDefaultTransportNode(
      this.getBatch(allocation.batchId)?.warehouse || 'WH-A01',
      newShelterId
    );
    allocation.reallocateTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    allocation.originalShelterId = oldShelter?.id;
    
    this.recalculateAllGaps();
    this.notify();
    
    return { success: true };
  }

  highPriorityPreempt(shelterId, specId, requiredQty) {
    const shelter = this.getShelter(shelterId);
    if (!shelter) return { success: false, error: '安置点不存在' };
    
    const priorityLevel = { 'urgent': 3, 'high': 2, 'medium': 1 };
    const currentPriority = priorityLevel[shelter.priority] || 0;
    
    if (currentPriority < 2) {
      return { success: false, error: '仅高优先级及以上安置点可抢占库存' };
    }
    
    const availableQty = this.getAvailableInventoryBySpec(specId);
    if (availableQty >= requiredQty) {
      return { success: false, error: '库存充足，无需抢占' };
    }
    
    const shortage = requiredQty - availableQty;
    const lowerPriorityAllocations = this.allocations.filter(a => {
      if (a.specId !== specId || a.status !== 'locked') return false;
      const targetShelter = this.getShelter(a.shelterId);
      if (!targetShelter) return false;
      return (priorityLevel[targetShelter.priority] || 0) < currentPriority;
    });
    
    const preemptedAllocations = [];
    let totalPreempted = 0;
    
    for (const alloc of lowerPriorityAllocations.sort((a, b) => {
      const sa = this.getShelter(a.shelterId);
      const sb = this.getShelter(b.shelterId);
      return (priorityLevel[sa?.priority] || 0) - (priorityLevel[sb?.priority] || 0);
    })) {
      if (totalPreempted >= shortage) break;
      
      const batch = this.getBatch(alloc.batchId);
      if (batch) {
        batch.lockedQty -= alloc.qty;
        batch.availableQty += alloc.qty;
      }
      
      alloc.status = 'preempted';
      alloc.preemptTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
      alloc.preemptedBy = shelterId;
      
      preemptedAllocations.push(alloc);
      totalPreempted += alloc.qty;
    }
    
    this.recalculateAllGaps();
    this.notify();
    
    return {
      success: true,
      preemptedQty: totalPreempted,
      preemptedAllocations,
      affectedShelters: [...new Set(preemptedAllocations.map(a => a.shelterId))]
    };
  }

  recalculateAllGaps() {
    this.shelters.forEach(shelter => {
      shelter.gap = this.getShelterGap(shelter.id);
    });
  }

  exportCommandList() {
    const lockedAllocations = this.allocations.filter(a => a.status === 'locked');
    const inTransitAllocations = this.allocations.filter(a => a.status === 'in_transit');
    
    let csv = '指挥清单\n';
    csv += '生成时间,' + new Date().toLocaleString() + '\n\n';
    
    csv += '待发运分配（锁定状态）\n';
    csv += '分配ID,批次号,帐篷规格,数量,目标安置点,创建时间,操作人\n';
    lockedAllocations.forEach(a => {
      const spec = this.getSpec(a.specId);
      const shelter = this.getShelter(a.shelterId);
      csv += `${a.id},${a.batchId},${spec?.name || a.specId},${a.qty},${shelter?.name || a.shelterId},${a.createTime},${a.operator}\n`;
    });
    
    csv += '\n运输中分配\n';
    csv += '分配ID,批次号,帐篷规格,数量,目标安置点,发运时间,运输节点\n';
    inTransitAllocations.forEach(a => {
      const spec = this.getSpec(a.specId);
      const shelter = this.getShelter(a.shelterId);
      const node = this.transportNodes.find(n => n.id === a.transportNode);
      csv += `${a.id},${a.batchId},${spec?.name || a.specId},${a.qty},${shelter?.name || a.shelterId},${a.shipTime},${node?.name || a.transportNode}\n`;
    });
    
    return csv;
  }

  getStatistics() {
    const totalTents = this.batches.reduce((sum, b) => sum + b.totalQty, 0);
    const availableTents = this.batches.reduce((sum, b) => sum + b.availableQty, 0);
    const lockedTents = this.batches.reduce((sum, b) => sum + b.lockedQty, 0);
    const shippedTents = this.batches.reduce((sum, b) => sum + b.shippedQty, 0);
    
    const totalPopulation = this.shelters.reduce((sum, s) => sum + s.currentPopulation, 0);
    const totalCapacity = this.shelters.reduce((sum, s) => sum + this.getShelterCapacityUsed(s.id), 0);
    const totalGap = this.shelters.reduce((sum, s) => sum + this.getShelterGap(s.id), 0);
    
    const allocByStatus = this.allocations.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + a.qty;
      return acc;
    }, {});
    
    return {
      totalTents,
      availableTents,
      lockedTents,
      shippedTents,
      totalPopulation,
      totalCapacity,
      totalGap,
      allocByStatus
    };
  }
}

const store = new TentAllocationStore();
store.recalculateAllGaps();
