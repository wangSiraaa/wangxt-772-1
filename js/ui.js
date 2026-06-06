let currentState = null;

function initApp() {
  currentState = store.getState();
  store.subscribe(render);
  render(currentState);
}

function render(state) {
  currentState = state;
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderHeader()}
    <div class="main-content">
      ${renderStatsBar()}
      ${renderDashboard()}
    </div>
  `;
  attachEventListeners();
}

function renderHeader() {
  const viewTitles = {
    'warehouse': '物资仓库视角',
    'shelter': '安置点管理员视角',
    'command': '指挥部视角'
  };
  
  return `
    <header class="app-header">
      <div class="header-title">
        <h1>🏕️ 应急帐篷调拨墙</h1>
        <div class="subtitle">${viewTitles[currentState.currentView]}</div>
      </div>
      <div class="view-switcher">
        <button class="view-btn ${currentState.currentView === 'warehouse' ? 'active' : ''}" data-view="warehouse">
          📦 物资仓库
        </button>
        <button class="view-btn ${currentState.currentView === 'shelter' ? 'active' : ''}" data-view="shelter">
          🏠 安置点
        </button>
        <button class="view-btn ${currentState.currentView === 'command' ? 'active' : ''}" data-view="command">
          🎯 指挥部
        </button>
      </div>
    </header>
  `;
}

function renderStatsBar() {
  const stats = store.getStatistics();
  
  return `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">帐篷总库存</div>
        <div class="stat-value">${stats.totalTents} 顶</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">可用库存</div>
        <div class="stat-value">${stats.availableTents} 顶</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">锁定/运输中</div>
        <div class="stat-value">${stats.lockedTents + (stats.allocByStatus.in_transit || 0)} 顶</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已发运</div>
        <div class="stat-value">${stats.shippedTents} 顶</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">安置总人数</div>
        <div class="stat-value">${stats.totalPopulation.toLocaleString()} 人</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">总缺口人数</div>
        <div class="stat-value">${stats.totalGap.toLocaleString()} 人</div>
      </div>
    </div>
  `;
}

function renderDashboard() {
  switch (currentState.currentView) {
    case 'warehouse':
      return renderWarehouseView();
    case 'shelter':
      return renderShelterView();
    case 'command':
    default:
      return renderCommandView();
  }
}

function renderWarehouseView() {
  return `
    <div class="dashboard-grid">
      <div class="panel">
        <div class="panel-header">
          <h3>📦 帐篷批次库存</h3>
          <div class="panel-actions">
            <button class="btn btn-primary btn-sm" id="btn-refresh">刷新</button>
          </div>
        </div>
        <div class="panel-body">
          ${renderBatchList()}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>🚚 出库分配记录</h3>
        </div>
        <div class="panel-body">
          ${renderAllocationList(['locked', 'in_transit', 'shipped', 'delivered'])}
        </div>
      </div>
    </div>
  `;
}

function renderShelterView() {
  return `
    <div class="dashboard-grid">
      <div class="panel">
        <div class="panel-header">
          <h3>🏠 安置点状态</h3>
        </div>
        <div class="panel-body">
          ${renderShelterList()}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>📋 接收分配记录</h3>
        </div>
        <div class="panel-body">
          ${renderAllocationList(['locked', 'in_transit', 'shipped', 'delivered'])}
        </div>
      </div>
    </div>
  `;
}

function renderCommandView() {
  return `
    <div class="dashboard-grid">
      <div class="panel">
        <div class="panel-header">
          <h3>📊 全局库存概览</h3>
          <div class="panel-actions">
            <button class="btn btn-success btn-sm" id="btn-export">导出指挥清单</button>
          </div>
        </div>
        <div class="panel-body">
          ${renderBatchList(true)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>🎯 安置点调度</h3>
        </div>
        <div class="panel-body">
          ${renderShelterList(true)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>📜 分配记录</h3>
          <div class="tabs">
            <button class="tab-btn active" data-tab="all">全部</button>
            <button class="tab-btn" data-tab="locked">待发运</button>
            <button class="tab-btn" data-tab="in_transit">运输中</button>
            <button class="tab-btn" data-tab="delivered">已送达</button>
          </div>
        </div>
        <div class="panel-body" id="allocation-panel">
          ${renderAllocationList(['locked', 'in_transit', 'shipped', 'delivered', 'cancelled', 'preempted'])}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>⚡ 快捷操作</h3>
        </div>
        <div class="panel-body">
          <div style="display: grid; gap: 0.75rem;">
            <button class="btn btn-primary" id="btn-quick-allocate">➕ 新建分配</button>
            <button class="btn btn-warning" id="btn-batch-ship">🚛 批量发运</button>
            <button class="btn btn-info" id="btn-preempt">⚡ 高优先级抢占</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBatchList(showAllocate = false) {
  if (currentState.batches.length === 0) {
    return '<p style="color: #718096; text-align: center; padding: 2rem;">暂无批次数据</p>';
  }
  
  return currentState.batches.map(batch => {
    const spec = store.getSpec(batch.specId);
    const canSplit = store.canSplitBatch(batch.id);
    const totalUsed = batch.lockedQty + batch.shippedQty;
    const availablePct = (batch.availableQty / batch.totalQty) * 100;
    const lockedPct = (batch.lockedQty / batch.totalQty) * 100;
    const shippedPct = (batch.shippedQty / batch.totalQty) * 100;
    
    return `
      <div class="batch-card" data-batch-id="${batch.id}">
        <div class="batch-header">
          <div>
            <div class="batch-title">${spec?.name || batch.specId}</div>
            <div class="batch-meta">
              <span class="warehouse-tag">${batch.warehouse}</span>
              批次号: ${batch.id} | 到货: ${batch.arriveDate}
            </div>
          </div>
          ${showAllocate ? `
            <button class="btn btn-primary btn-sm btn-allocate" data-batch-id="${batch.id}" ${!canSplit ? 'disabled' : ''}>
              分配
            </button>
          ` : ''}
        </div>
        <div class="progress-bar">
          <div class="progress-fill available" style="width: ${availablePct}%"></div>
          <div class="progress-fill locked" style="width: ${lockedPct}%"></div>
          <div class="progress-fill shipped" style="width: ${shippedPct}%"></div>
        </div>
        <div class="batch-stats">
          <div class="batch-stat">
            <span class="stat-num">${batch.availableQty}</span>
            <span class="stat-label">可用</span>
          </div>
          <div class="batch-stat">
            <span class="stat-num">${batch.lockedQty}</span>
            <span class="stat-label">锁定</span>
          </div>
          <div class="batch-stat">
            <span class="stat-num">${batch.shippedQty}</span>
            <span class="stat-label">已发运</span>
          </div>
          <div class="batch-stat">
            <span class="stat-num">${batch.totalQty}</span>
            <span class="stat-label">总计</span>
          </div>
        </div>
        <div class="batch-legend">
          <div class="legend-item">
            <div class="legend-color" style="background: #38a169;"></div>
            可用
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #d69e2e;"></div>
            锁定
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #3182ce;"></div>
            已发运
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderShelterList(showActions = false) {
  if (currentState.shelters.length === 0) {
    return '<p style="color: #718096; text-align: center; padding: 2rem;">暂无安置点数据</p>';
  }
  
  const priorityLabels = {
    'urgent': '紧急',
    'high': '高',
    'medium': '中'
  };
  
  return currentState.shelters.map(shelter => {
    const capacityUsed = store.getShelterCapacityUsed(shelter.id);
    const gap = store.getShelterGap(shelter.id);
    const usagePct = Math.min((shelter.currentPopulation / shelter.maxCapacity) * 100, 100);
    const gapPct = shelter.currentPopulation > 0 ? (gap / shelter.currentPopulation) * 100 : 0;
    
    const tentDetails = Object.entries(shelter.assignedTents).map(([specId, qty]) => {
      const spec = store.getSpec(specId);
      return `${spec?.name || specId}: ${qty}顶`;
    }).join(' | ');
    
    return `
      <div class="shelter-card" data-shelter-id="${shelter.id}">
        <div class="shelter-header">
          <div>
            <div class="shelter-title">${shelter.name}</div>
            <div class="shelter-meta">${shelter.location}</div>
          </div>
          <span class="priority-badge priority-${shelter.priority}">${priorityLabels[shelter.priority]}优先级</span>
        </div>
        <div class="capacity-info">
          <span>当前人数: ${shelter.currentPopulation.toLocaleString()} / ${shelter.maxCapacity.toLocaleString()}</span>
          <span class="gap">缺口: ${gap.toLocaleString()} 人</span>
        </div>
        <div class="gap-bar">
          <div class="gap-fill" style="width: ${gapPct}%"></div>
        </div>
        <div class="shelter-capacity-details">
          <div class="detail-item">帐篷容量:</div>
          <div class="detail-value">${capacityUsed.toLocaleString()} 人</div>
          <div class="detail-item">场地使用率:</div>
          <div class="detail-value">${usagePct.toFixed(1)}%</div>
          <div class="detail-item">已分配:</div>
          <div class="detail-value" style="grid-column: 2;">${tentDetails || '无'}</div>
        </div>
        <div class="allocation-actions">
          ${showActions ? `
            <button class="btn btn-primary btn-sm btn-request-allocate" data-shelter-id="${shelter.id}">申请调拨</button>
            <button class="btn btn-warning btn-sm btn-adjust-priority" data-shelter-id="${shelter.id}">调整优先级</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderAllocationList(statuses = []) {
  const filteredAllocs = currentState.allocations.filter(a => statuses.includes(a.status));
  
  if (filteredAllocs.length === 0) {
    return '<p style="color: #718096; text-align: center; padding: 2rem;">暂无分配记录</p>';
  }
  
  const statusLabels = {
    'locked': '待发运',
    'in_transit': '运输中',
    'shipped': '已发运',
    'delivered': '已送达',
    'cancelled': '已撤销',
    'preempted': '已被抢占'
  };
  
  return filteredAllocs.map(alloc => {
    const spec = store.getSpec(alloc.specId);
    const shelter = store.getShelter(alloc.shelterId);
    const batch = store.getBatch(alloc.batchId);
    const canCancel = alloc.status === 'locked';
    const canShip = alloc.status === 'locked';
    const canReallocate = alloc.status === 'locked';
    const canConfirm = alloc.status === 'in_transit';
    
    return `
      <div class="allocation-card" data-allocation-id="${alloc.id}">
        <div class="allocation-header">
          <div>
            <div class="allocation-title">${alloc.id} - ${spec?.name || alloc.specId} × ${alloc.qty}</div>
            <div class="allocation-meta">
              批次: ${batch?.id || alloc.batchId} | 目标: ${shelter?.name || alloc.shelterId}
            </div>
          </div>
          <span class="status-badge status-${alloc.status}">${statusLabels[alloc.status] || alloc.status}</span>
        </div>
        <div class="allocation-meta">
          创建: ${alloc.createTime} | 操作人: ${alloc.operator}
          ${alloc.shipTime ? `| 发运: ${alloc.shipTime}` : ''}
          ${alloc.deliveryTime ? `| 送达: ${alloc.deliveryTime}` : ''}
        </div>
        <div class="allocation-actions">
          ${canShip ? `<button class="btn btn-success btn-sm btn-ship" data-allocation-id="${alloc.id}">发运</button>` : ''}
          ${canConfirm ? `<button class="btn btn-success btn-sm btn-confirm" data-allocation-id="${alloc.id}">确认送达</button>` : ''}
          ${canReallocate ? `<button class="btn btn-warning btn-sm btn-reallocate" data-allocation-id="${alloc.id}">改派</button>` : ''}
          ${canCancel ? `<button class="btn btn-danger btn-sm btn-cancel" data-allocation-id="${alloc.id}">撤销</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function attachEventListeners() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      store.setView(e.target.dataset.view);
    });
  });
  
  document.querySelectorAll('.btn-allocate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openAllocateModal(e.target.dataset.batchId);
    });
  });
  
  document.querySelectorAll('.btn-request-allocate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openRequestModal(e.target.dataset.shelterId);
    });
  });
  
  document.querySelectorAll('.btn-ship').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleShipAllocation(e.target.dataset.allocationId);
    });
  });
  
  document.querySelectorAll('.btn-confirm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleConfirmDelivery(e.target.dataset.allocationId);
    });
  });
  
  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleCancelAllocation(e.target.dataset.allocationId);
    });
  });
  
  document.querySelectorAll('.btn-reallocate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openReallocateModal(e.target.dataset.allocationId);
    });
  });
  
  const quickAllocateBtn = document.getElementById('btn-quick-allocate');
  if (quickAllocateBtn) {
    quickAllocateBtn.addEventListener('click', () => openAllocateModal());
  }
  
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
  
  const preemptBtn = document.getElementById('btn-preempt');
  if (preemptBtn) {
    preemptBtn.addEventListener('click', openPreemptModal);
  }
  
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      store.notify();
      showToast('数据已刷新', 'success');
    });
  }
  
  const batchShipBtn = document.getElementById('btn-batch-ship');
  if (batchShipBtn) {
    batchShipBtn.addEventListener('click', handleBatchShip);
  }
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const tab = e.target.dataset.tab;
      const panel = document.getElementById('allocation-panel');
      if (panel) {
        const statusMap = {
          'all': ['locked', 'in_transit', 'shipped', 'delivered', 'cancelled', 'preempted'],
          'locked': ['locked'],
          'in_transit': ['in_transit'],
          'delivered': ['delivered']
        };
        panel.innerHTML = renderAllocationList(statusMap[tab] || statusMap['all']);
        attachAllocationPanelListeners();
      }
    });
  });
  
  attachAllocationPanelListeners();
}

function attachAllocationPanelListeners() {
  document.querySelectorAll('.btn-ship').forEach(btn => {
    if (!btn.dataset.listenerAttached) {
      btn.dataset.listenerAttached = 'true';
      btn.addEventListener('click', (e) => {
        handleShipAllocation(e.target.dataset.allocationId);
      });
    }
  });
  
  document.querySelectorAll('.btn-confirm').forEach(btn => {
    if (!btn.dataset.listenerAttached) {
      btn.dataset.listenerAttached = 'true';
      btn.addEventListener('click', (e) => {
        handleConfirmDelivery(e.target.dataset.allocationId);
      });
    }
  });
  
  document.querySelectorAll('.btn-cancel').forEach(btn => {
    if (!btn.dataset.listenerAttached) {
      btn.dataset.listenerAttached = 'true';
      btn.addEventListener('click', (e) => {
        handleCancelAllocation(e.target.dataset.allocationId);
      });
    }
  });
  
  document.querySelectorAll('.btn-reallocate').forEach(btn => {
    if (!btn.dataset.listenerAttached) {
      btn.dataset.listenerAttached = 'true';
      btn.addEventListener('click', (e) => {
        openReallocateModal(e.target.dataset.allocationId);
      });
    }
  });
}

function openAllocateModal(batchId = null) {
  const batches = currentState.batches.filter(b => store.canSplitBatch(b.id));
  const shelters = currentState.shelters;
  
  const modalHtml = `
    <div class="modal-overlay" id="allocate-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>分配帐篷</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择批次</label>
            <select id="alloc-batch-select">
              ${batches.map(b => {
                const spec = store.getSpec(b.specId);
                return `<option value="${b.id}" ${b.id === batchId ? 'selected' : ''}>
                  ${b.id} - ${spec?.name} (可用: ${b.availableQty})
                </option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>目标安置点</label>
            <select id="alloc-shelter-select">
              ${shelters.map(s => `
                <option value="${s.id}">${s.name} (缺口: ${store.getShelterGap(s.id)}人)</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>分配数量</label>
            <input type="number" id="alloc-qty" min="1" value="1">
          </div>
          <div id="alloc-preview"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="btn-confirm-allocate">确认分配</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modal-container').innerHTML = modalHtml;
  
  document.getElementById('alloc-batch-select').addEventListener('change', updateAllocPreview);
  document.getElementById('alloc-shelter-select').addEventListener('change', updateAllocPreview);
  document.getElementById('alloc-qty').addEventListener('input', updateAllocPreview);
  
  document.getElementById('btn-confirm-allocate').addEventListener('click', handleAllocate);
  
  updateAllocPreview();
}

function updateAllocPreview() {
  const batchId = document.getElementById('alloc-batch-select').value;
  const shelterId = document.getElementById('alloc-shelter-select').value;
  const qty = parseInt(document.getElementById('alloc-qty').value) || 0;
  
  const previewDiv = document.getElementById('alloc-preview');
  const batch = store.getBatch(batchId);
  const shelter = store.getShelter(shelterId);
  const spec = store.getSpec(batch?.specId);
  
  if (!batch || !shelter || qty <= 0) {
    previewDiv.innerHTML = '';
    return;
  }
  
  const capacityCheck = store.checkCapacityOverflow(shelterId, { [batch.specId]: qty });
  const newGap = store.calculateShelterGapWithNewAllocation(shelterId, { [batch.specId]: qty });
  
  let previewHtml = `
    <div class="alert alert-info">
      <strong>预分配预览:</strong><br>
      帐篷: ${spec?.name} × ${qty} 顶 (可容纳 ${spec?.capacity * qty} 人)<br>
      分配后缺口: ${newGap.toLocaleString()} 人
    </div>
  `;
  
  if (!capacityCheck.canFit) {
    previewHtml += `
      <div class="alert alert-error">
        <strong>⚠️ 容量不足!</strong> 超出 ${capacityCheck.overflow} 人
        <ul class="suggestion-list">
          ${capacityCheck.suggestion?.map(s => `<li>${s.message}</li>`).join('') || ''}
        </ul>
      </div>
    `;
  }
  
  previewDiv.innerHTML = previewHtml;
}

function handleAllocate() {
  const batchId = document.getElementById('alloc-batch-select').value;
  const shelterId = document.getElementById('alloc-shelter-select').value;
  const qty = parseInt(document.getElementById('alloc-qty').value) || 0;
  
  const result = store.allocateTents(batchId, shelterId, qty);
  
  if (result.success) {
    closeModal();
    showToast(`分配成功! 分配ID: ${result.allocationId}`, 'success');
  } else {
    let errorMsg = result.error;
    if (result.suggestions && result.suggestions.length > 0) {
      errorMsg += '\n建议:\n' + result.suggestions.map(s => s.message).join('\n');
    }
    showToast(errorMsg, 'error');
  }
}

function openReallocateModal(allocationId) {
  const allocation = currentState.allocations.find(a => a.id === allocationId);
  if (!allocation) return;
  
  const shelters = currentState.shelters.filter(s => s.id !== allocation.shelterId);
  
  const modalHtml = `
    <div class="modal-overlay" id="reallocate-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>改派分配 - ${allocation.id}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info">
            当前分配: ${store.getSpec(allocation.specId)?.name} × ${allocation.qty} 顶 → ${store.getShelter(allocation.shelterId)?.name}
          </div>
          <div class="form-group">
            <label>改派至</label>
            <select id="realloc-shelter-select">
              ${shelters.map(s => `
                <option value="${s.id}">${s.name} (缺口: ${store.getShelterGap(s.id)}人)</option>
              `).join('')}
            </select>
          </div>
          <div id="realloc-preview"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-warning" id="btn-confirm-reallocate">确认改派</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modal-container').innerHTML = modalHtml;
  
  document.getElementById('realloc-shelter-select').addEventListener('change', () => {
    const newShelterId = document.getElementById('realloc-shelter-select').value;
    const capacityCheck = store.checkCapacityOverflow(newShelterId, { [allocation.specId]: allocation.qty });
    
    const previewDiv = document.getElementById('realloc-preview');
    if (!capacityCheck.canFit) {
      previewDiv.innerHTML = `
        <div class="alert alert-error">
          <strong>⚠️ 目标安置点容量不足!</strong> 超出 ${capacityCheck.overflow} 人
        </div>
      `;
    } else {
      previewDiv.innerHTML = '';
    }
  });
  
  document.getElementById('btn-confirm-reallocate').addEventListener('click', () => {
    const newShelterId = document.getElementById('realloc-shelter-select').value;
    const result = store.reallocateAllocation(allocationId, newShelterId);
    
    if (result.success) {
      closeModal();
      showToast('改派成功!', 'success');
    } else {
      showToast(result.error, 'error');
    }
  });
}

function openRequestModal(shelterId) {
  const shelter = store.getShelter(shelterId);
  const gap = store.getShelterGap(shelterId);
  
  const specs = currentState.specs;
  const batches = currentState.batches.filter(b => store.canSplitBatch(b.id));
  
  const modalHtml = `
    <div class="modal-overlay" id="request-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>申请调拨 - ${shelter?.name}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-warning">
            当前缺口: <strong>${gap.toLocaleString()} 人</strong>
          </div>
          <div class="form-group">
            <label>选择批次</label>
            <select id="req-batch-select">
              ${batches.map(b => {
                const spec = store.getSpec(b.specId);
                return `<option value="${b.id}">
                  ${spec?.name} - ${b.id} (可用: ${b.availableQty}, 单顶容纳: ${spec?.capacity}人)
                </option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>申请数量</label>
            <input type="number" id="req-qty" min="1" value="1">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="btn-confirm-request">提交申请</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modal-container').innerHTML = modalHtml;
  
  document.getElementById('btn-confirm-request').addEventListener('click', () => {
    const batchId = document.getElementById('req-batch-select').value;
    const qty = parseInt(document.getElementById('req-qty').value) || 0;
    
    const result = store.allocateTents(batchId, shelterId, qty);
    
    if (result.success) {
      closeModal();
      showToast(`申请成功! 分配ID: ${result.allocationId}`, 'success');
    } else {
      showToast(result.error, 'error');
    }
  });
}

function openPreemptModal() {
  const highPriorityShelters = currentState.shelters.filter(s => 
    s.priority === 'high' || s.priority === 'urgent'
  );
  const specs = currentState.specs;
  
  const modalHtml = `
    <div class="modal-overlay" id="preempt-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>⚡ 高优先级库存抢占</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-warning">
            <strong>注意:</strong> 此操作将从低优先级安置点的锁定分配中抢占库存。被抢占的分配将被释放回可用库存。
          </div>
          <div class="form-group">
            <label>高优先级安置点</label>
            <select id="preempt-shelter-select">
              ${highPriorityShelters.map(s => `
                <option value="${s.id}">${s.name} (缺口: ${store.getShelterGap(s.id)}人)</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>帐篷规格</label>
            <select id="preempt-spec-select">
              ${specs.map(s => `
                <option value="${s.id}">${s.name} (单顶容纳: ${s.capacity}人)</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>需要数量</label>
            <input type="number" id="preempt-qty" min="1" value="1">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-danger" id="btn-confirm-preempt">确认抢占</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modal-container').innerHTML = modalHtml;
  
  document.getElementById('btn-confirm-preempt').addEventListener('click', () => {
    const shelterId = document.getElementById('preempt-shelter-select').value;
    const specId = document.getElementById('preempt-spec-select').value;
    const qty = parseInt(document.getElementById('preempt-qty').value) || 0;
    
    const result = store.highPriorityPreempt(shelterId, specId, qty);
    
    if (result.success) {
      closeModal();
      showToast(`抢占成功! 已抢占 ${result.preemptedQty} 顶，影响 ${result.affectedShelters.length} 个安置点`, 'warning');
    } else {
      showToast(result.error, 'error');
    }
  });
}

function handleShipAllocation(allocationId) {
  const result = store.shipAllocation(allocationId);
  if (result.success) {
    showToast('发运成功!', 'success');
  } else {
    showToast(result.error, 'error');
  }
}

function handleConfirmDelivery(allocationId) {
  const result = store.confirmDelivery(allocationId);
  if (result.success) {
    showToast('送达确认成功!', 'success');
  } else {
    showToast(result.error, 'error');
  }
}

function handleCancelAllocation(allocationId) {
  if (confirm('确定要撤销此分配吗？')) {
    const result = store.cancelAllocation(allocationId);
    if (result.success) {
      showToast('撤销成功! 库存已释放', 'success');
    } else {
      showToast(result.error, 'error');
    }
  }
}

function handleBatchShip() {
  const lockedAllocs = currentState.allocations.filter(a => a.status === 'locked');
  
  if (lockedAllocs.length === 0) {
    showToast('没有待发运的分配', 'warning');
    return;
  }
  
  let successCount = 0;
  lockedAllocs.forEach(alloc => {
    const result = store.shipAllocation(alloc.id);
    if (result.success) successCount++;
  });
  
  showToast(`批量发运完成! 成功 ${successCount}/${lockedAllocs.length} 条`, successCount > 0 ? 'success' : 'error');
}

function handleExport() {
  const csv = store.exportCommandList();
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `指挥清单_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  showToast('指挥清单已导出', 'success');
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
