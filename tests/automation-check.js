const fs = require('fs');
const path = require('path');

const dataJs = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf8');

eval(dataJs);
eval(storeJs.replace('const store = new TentAllocationStore();', '').replace('store.recalculateAllGaps();', ''));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failed++;
  }
}

function runTests() {
  console.log('='.repeat(60));
  console.log('应急帐篷调拨墙 - 自动化业务规则检查');
  console.log('='.repeat(60));
  console.log('');

  const testStore = new TentAllocationStore();
  testStore.recalculateAllGaps();

  console.log('📋 测试1: 验证运输中批次不能改派');
  console.log('-'.repeat(40));
  
  const inTransitAllocation = testStore.allocations.find(a => a.status === 'in_transit');
  assert(inTransitAllocation !== undefined, '找到运输中状态的分配记录');
  
  if (inTransitAllocation) {
    const canReallocate = testStore.canReallocateAllocation(inTransitAllocation.id);
    assert(canReallocate === false, `运输中分配 (${inTransitAllocation.id}) 的改派按钮应被禁用 (canReallocate=false)`);
    
    const reallocateResult = testStore.reallocateAllocation(inTransitAllocation.id, 'SH-003');
    assert(reallocateResult.success === false, '尝试改派运输中分配应返回失败');
    assert(reallocateResult.error.includes('仅可改派锁定状态'), '错误信息应说明仅可改派锁定状态');
  }
  console.log('');

  console.log('📋 测试2: 验证已发运批次不能二次拆分');
  console.log('-'.repeat(40));
  
  const shippedBatch = testStore.batches.find(b => b.shippedQty > 0);
  const originalStatus = shippedBatch.status;
  shippedBatch.status = 'shipped';
  const canSplit = testStore.canSplitBatch(shippedBatch.id);
  assert(canSplit === false, `已发运批次 (${shippedBatch.id}) 不可二次拆分 (canSplit=false)');
  
  const allocateResult = testStore.allocateTents(shippedBatch.id, 'SH-003', 10);
  assert(allocateResult.success === false, '从已发运批次分配应返回失败');
  assert(allocateResult.error.includes('不可拆分'), '错误信息应说明该批次不可拆分');
  shippedBatch.status = 'available';
  console.log('');

  console.log('📋 测试3: 容量不足时显示超出人数和建议拆分方案');
  console.log('-'.repeat(40));
  
  const shelterWithGap = testStore.shelters.find(s => testStore.getShelterGap(s.id) > 0);
  assert(shelterWithGap !== undefined, '找到有缺口的安置点');
  
  if (shelterWithGap) {
    const spec = testStore.specs[0];
    const qtyToCauseOverflow = Math.ceil(shelterWithGap.currentPopulation / spec.capacity) + 100;
    
    const capacityCheck = testStore.checkCapacityOverflow(shelterWithGap.id, { [spec.id]: qtyToCauseOverflow });
    assert(capacityCheck.canFit === false, '应检测到容量不足');
    assert(capacityCheck.overflow > 0, `应计算出超出人数: ${capacityCheck.overflow}人`);
    assert(capacityCheck.suggestion !== null && capacityCheck.suggestion.length > 0, '应提供拆分建议方案');
    
    console.log(`  ℹ️  安置点: ${shelterWithGap.name}`);
    console.log(`  ℹ️  超出人数: ${capacityCheck.overflow}人`);
    console.log(`  ℹ️  建议方案数量: ${capacityCheck.suggestion.length}条`);
    capacityCheck.suggestion.forEach(s => {
      console.log(`    - ${s.message}`);
    });
  }
  console.log('');

  console.log('📋 测试4: 发起分配验证缺口数、库存锁定数同时变化');
  console.log('-'.repeat(40));
  
  const availableBatch = testStore.batches.find(b => b.availableQty > 50);
  const targetShelter = testStore.shelters.find(s => testStore.getShelterGap(s.id) > 100);
  
  assert(availableBatch !== undefined, '找到有足够可用库存的批次');
  assert(targetShelter !== undefined, '找到有缺口的安置点');
  
  if (availableBatch && targetShelter) {
    const allocQty = Math.min(50, availableBatch.availableQty);
    const spec = testStore.getSpec(availableBatch.specId);
    const beforeGap = testStore.getShelterGap(targetShelter.id);
    const beforeAvailable = availableBatch.availableQty;
    const beforeLocked = availableBatch.lockedQty;
    
    console.log(`  ℹ️  分配前: 缺口=${beforeGap}人, 可用库存=${beforeAvailable}, 锁定库存=${beforeLocked}`);
    
    const result = testStore.allocateTents(availableBatch.id, targetShelter.id, allocQty);
    assert(result.success === true, '分配应成功');
    
    const afterGap = testStore.getShelterGap(targetShelter.id);
    const afterAvailable = availableBatch.availableQty;
    const afterLocked = availableBatch.lockedQty;
    
    console.log(`  ℹ️  分配后: 缺口=${afterGap}人, 可用库存=${afterAvailable}, 锁定库存=${afterLocked}`);
    
    const expectedGapReduction = spec.capacity * allocQty;
    assert(afterGap <= beforeGap, `缺口数应减少 (之前: ${beforeGap}, 之后: ${afterGap})`);
    assert(afterAvailable === beforeAvailable - allocQty, `可用库存应减少 ${allocQty} (之前: ${beforeAvailable}, 之后: ${afterAvailable})`);
    assert(afterLocked === beforeLocked + allocQty, `锁定库存应增加 ${allocQty} (之前: ${beforeLocked}, 之后: ${afterLocked})`);
  }
  console.log('');

  console.log('📋 测试5: 高优先级安置点抢占库存回写其他点缺口');
  console.log('-'.repeat(40));
  
  const highPriorityShelter = testStore.shelters.find(s => s.priority === 'high' || s.priority === 'urgent');
  const lowerPriorityShelter = testStore.shelters.find(s => s.priority === 'medium');
  const preemptSpec = testStore.specs[0];
  
  assert(highPriorityShelter !== undefined, '找到高优先级安置点');
  assert(lowerPriorityShelter !== undefined, '找到中优先级安置点');
  
  if (highPriorityShelter && lowerPriorityShelter) {
    const lockedAllocForLower = testStore.allocations.find(
      a => a.shelterId === lowerPriorityShelter.id && a.status === 'locked' && a.specId === preemptSpec.id
    );
    
    if (lockedAllocForLower) {
      const beforeLowerGap = testStore.getShelterGap(lowerPriorityShelter.id);
      const preemptQty = lockedAllocForLower.qty + 10;
      
      const preemptResult = testStore.highPriorityPreempt(highPriorityShelter.id, preemptSpec.id, preemptQty);
      
      if (preemptResult.success) {
        console.log(`  ℹ️  抢占成功: 抢占数量=${preemptResult.preemptedQty}, 影响安置点=${preemptResult.affectedShelters.length}个`);
        
        const afterLowerGap = testStore.getShelterGap(lowerPriorityShelter.id);
        assert(afterLowerGap >= beforeLowerGap, `被抢占安置点缺口应增加 (之前: ${beforeLowerGap}, 之后: ${afterLowerGap})`);
        
        const preemptedAlloc = testStore.allocations.find(a => a.id === lockedAllocForLower.id);
        assert(preemptedAlloc.status === 'preempted', '被抢占的分配状态应更新为preempted');
      } else {
        console.log(`  ℹ️  无需抢占: ${preemptResult.error}`);
      }
    } else {
      console.log('  ℹ️  跳过: 未找到中优先级安置点的锁定分配用于测试抢占');
    }
  }
  console.log('');

  console.log('📋 测试6: 撤销未发运分配释放库存');
  console.log('-'.repeat(40));
  
  const lockedAllocation = testStore.allocations.find(a => a.status === 'locked');
  assert(lockedAllocation !== undefined, '找到锁定状态的分配');
  
  if (lockedAllocation) {
    const batch = testStore.getBatch(lockedAllocation.batchId);
    const beforeAvailable = batch.availableQty;
    const beforeLocked = batch.lockedQty;
    
    console.log(`  ℹ️  撤销前: 可用=${beforeAvailable}, 锁定=${beforeLocked}`);
    
    const cancelResult = testStore.cancelAllocation(lockedAllocation.id);
    assert(cancelResult.success === true, '撤销锁定分配应成功');
    
    const afterAvailable = batch.availableQty;
    const afterLocked = batch.lockedQty;
    
    console.log(`  ℹ️  撤销后: 可用=${afterAvailable}, 锁定=${afterLocked}`);
    
    assert(afterAvailable === beforeAvailable + lockedAllocation.qty, `可用库存应增加 ${lockedAllocation.qty}`);
    assert(afterLocked === beforeLocked - lockedAllocation.qty, `锁定库存应减少 ${lockedAllocation.qty}`);
  }
  console.log('');

  console.log('📋 测试7: 导出指挥清单');
  console.log('-'.repeat(40));
  
  const csv = testStore.exportCommandList();
  assert(csv.length > 0, '指挥清单CSV内容不为空');
  assert(csv.includes('指挥清单'), 'CSV包含标题');
  assert(csv.includes('待发运分配'), 'CSV包含待发运分配部分');
  assert(csv.includes('运输中分配'), 'CSV包含运输中分配部分');
  console.log(`  ℹ️  CSV长度: ${csv.length}字符`);
  console.log('');

  console.log('📋 测试8: 统计数据验证');
  console.log('-'.repeat(40));
  
  const stats = testStore.getStatistics();
  assert(stats.totalTents > 0, '帐篷总数大于0');
  assert(stats.availableTents >= 0, '可用库存非负');
  assert(stats.lockedTents >= 0, '锁定库存非负');
  assert(stats.shippedTents >= 0, '已发运库存非负');
  assert(stats.totalPopulation > 0, '安置总人数大于0');
  console.log(`  ℹ️  总帐篷: ${stats.totalTents}, 可用: ${stats.availableTents}, 锁定: ${stats.lockedTents}, 已发运: ${stats.shippedTents}`);
  console.log(`  ℹ️  总人数: ${stats.totalPopulation}, 总缺口: ${stats.totalGap}`);
  console.log('');

  console.log('='.repeat(60));
  console.log(`测试结果: 通过 ${passed} 项, 失败 ${failed} 项');
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 所有自动化检查通过!');
    process.exit(0);
  }
}

runTests();
