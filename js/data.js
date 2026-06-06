const TentSpecs = [
  { id: 'SPEC-12', name: '12人标准帐篷', capacity: 12, weight: 85, unit: '顶' },
  { id: 'SPEC-24', name: '24人大型帐篷', capacity: 24, weight: 180, unit: '顶' },
  { id: 'SPEC-6', name: '6人家庭帐篷', capacity: 6, weight: 45, unit: '顶' },
  { id: 'SPEC-MED', name: '医疗专用帐篷', capacity: 8, weight: 120, unit: '顶' },
  { id: 'SPEC-COM', name: '指挥通讯帐篷', capacity: 10, weight: 150, unit: '顶' }
];

const TentBatches = [
  {
    id: 'BATCH-001',
    specId: 'SPEC-12',
    totalQty: 500,
    availableQty: 320,
    lockedQty: 120,
    shippedQty: 60,
    warehouse: 'WH-A01',
    arriveDate: '2026-06-01',
    status: 'available',
    manufactureDate: '2026-05-15'
  },
  {
    id: 'BATCH-002',
    specId: 'SPEC-24',
    totalQty: 200,
    availableQty: 80,
    lockedQty: 70,
    shippedQty: 50,
    warehouse: 'WH-A01',
    arriveDate: '2026-06-02',
    status: 'available',
    manufactureDate: '2026-05-20'
  },
  {
    id: 'BATCH-003',
    specId: 'SPEC-6',
    totalQty: 800,
    availableQty: 560,
    lockedQty: 140,
    shippedQty: 100,
    warehouse: 'WH-B02',
    arriveDate: '2026-06-03',
    status: 'available',
    manufactureDate: '2026-05-25'
  },
  {
    id: 'BATCH-004',
    specId: 'SPEC-MED',
    totalQty: 50,
    availableQty: 15,
    lockedQty: 20,
    shippedQty: 15,
    warehouse: 'WH-A01',
    arriveDate: '2026-06-01',
    status: 'available',
    manufactureDate: '2026-05-10'
  },
  {
    id: 'BATCH-005',
    specId: 'SPEC-COM',
    totalQty: 30,
    availableQty: 10,
    lockedQty: 12,
    shippedQty: 8,
    warehouse: 'WH-C03',
    arriveDate: '2026-06-02',
    status: 'available',
    manufactureDate: '2026-05-18'
  }
];

const Shelters = [
  {
    id: 'SH-001',
    name: '东山中学安置点',
    location: '东山区学苑路1号',
    maxCapacity: 2000,
    currentPopulation: 1560,
    priority: 'high',
    contact: '张主任 138****1234',
    assignedTents: { 'SPEC-12': 80, 'SPEC-24': 20, 'SPEC-6': 60 },
    status: 'active'
  },
  {
    id: 'SH-002',
    name: '西山体育馆安置点',
    location: '西山区体育中心',
    maxCapacity: 3000,
    currentPopulation: 2850,
    priority: 'urgent',
    contact: '李主任 139****5678',
    assignedTents: { 'SPEC-12': 120, 'SPEC-24': 40, 'SPEC-MED': 8, 'SPEC-6': 100 },
    status: 'active'
  },
  {
    id: 'SH-003',
    name: '南区小学安置点',
    location: '南区育才路56号',
    maxCapacity: 1500,
    currentPopulation: 1420,
    priority: 'medium',
    contact: '王主任 137****9012',
    assignedTents: { 'SPEC-12': 60, 'SPEC-6': 80 },
    status: 'active'
  },
  {
    id: 'SH-004',
    name: '北区公园安置点',
    location: '北区人民公园',
    maxCapacity: 5000,
    currentPopulation: 4200,
    priority: 'high',
    contact: '赵主任 136****3456',
    assignedTents: { 'SPEC-12': 200, 'SPEC-24': 60, 'SPEC-6': 150, 'SPEC-MED': 5, 'SPEC-COM': 4 },
    status: 'active'
  },
  {
    id: 'SH-005',
    name: '开发区会展中心安置点',
    location: '开发区会展路88号',
    maxCapacity: 4000,
    currentPopulation: 3100,
    priority: 'medium',
    contact: '孙主任 135****7890',
    assignedTents: { 'SPEC-12': 150, 'SPEC-24': 30, 'SPEC-6': 120, 'SPEC-COM': 3 },
    status: 'active'
  }
];

const TransportNodes = [
  { id: 'NODE-01', name: 'WH-A01仓库', type: 'warehouse', status: 'operational' },
  { id: 'NODE-02', name: 'WH-B02仓库', type: 'warehouse', status: 'operational' },
  { id: 'NODE-03', name: 'WH-C03仓库', type: 'warehouse', status: 'operational' },
  { id: 'NODE-04', name: '东山转运站', type: 'transit', status: 'operational' },
  { id: 'NODE-05', name: '西山转运站', type: 'transit', status: 'operational' },
  { id: 'NODE-06', name: '南区转运站', type: 'transit', status: 'operational' }
];

const AllocationRecords = [
  {
    id: 'ALLOC-001',
    batchId: 'BATCH-001',
    shelterId: 'SH-001',
    specId: 'SPEC-12',
    qty: 30,
    status: 'shipped',
    createTime: '2026-06-04 09:30:00',
    shipTime: '2026-06-04 14:00:00',
    transportNode: 'NODE-04',
    operator: '指挥部-王指挥'
  },
  {
    id: 'ALLOC-002',
    batchId: 'BATCH-001',
    shelterId: 'SH-002',
    specId: 'SPEC-12',
    qty: 40,
    status: 'in_transit',
    createTime: '2026-06-05 08:15:00',
    shipTime: '2026-06-05 10:30:00',
    transportNode: 'NODE-05',
    operator: '指挥部-李指挥'
  },
  {
    id: 'ALLOC-003',
    batchId: 'BATCH-002',
    shelterId: 'SH-004',
    specId: 'SPEC-24',
    qty: 20,
    status: 'shipped',
    createTime: '2026-06-04 11:00:00',
    shipTime: '2026-06-04 16:00:00',
    transportNode: 'NODE-04',
    operator: '指挥部-张指挥'
  },
  {
    id: 'ALLOC-004',
    batchId: 'BATCH-003',
    shelterId: 'SH-003',
    specId: 'SPEC-6',
    qty: 50,
    status: 'in_transit',
    createTime: '2026-06-05 09:00:00',
    shipTime: '2026-06-05 11:00:00',
    transportNode: 'NODE-06',
    operator: '仓库-刘管理员'
  },
  {
    id: 'ALLOC-005',
    batchId: 'BATCH-001',
    shelterId: 'SH-005',
    specId: 'SPEC-12',
    qty: 50,
    status: 'locked',
    createTime: '2026-06-06 07:30:00',
    shipTime: null,
    transportNode: 'NODE-04',
    operator: '指挥部-王指挥'
  },
  {
    id: 'ALLOC-006',
    batchId: 'BATCH-002',
    shelterId: 'SH-002',
    specId: 'SPEC-24',
    qty: 30,
    status: 'locked',
    createTime: '2026-06-06 08:00:00',
    shipTime: null,
    transportNode: 'NODE-05',
    operator: '指挥部-李指挥'
  }
];

const Warehouses = [
  { id: 'WH-A01', name: '中心仓库A区', location: '市中心物流园', capacity: 10000, currentLoad: 6500 },
  { id: 'WH-B02', name: '南区仓库B区', location: '南区工业园', capacity: 8000, currentLoad: 5200 },
  { id: 'WH-C03', name: '北区仓库C区', location: '北区物流中心', capacity: 6000, currentLoad: 3800 }
];
