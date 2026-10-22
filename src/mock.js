// --mock 模式的示例数据（价格/券均为虚构示例，仅用于离线演示，以官方实时结果为准）
export const MOCK = {
  now: { date: '2026-10-24', weekday: '星期六', time: '15:00', festival: '1024 程序员节' },
  stores: [
    { storeCode: 'SH1024', storeName: '麦当劳 张江高科餐厅', address: '上海市浦东新区张江路 1024 号', distance: 320 },
    { storeCode: 'BJ0042', storeName: '麦当劳 中关村餐厅', address: '北京市海淀区中关村大街 42 号', distance: 860 },
  ],
  menu: [
    { code: 'BM001', name: '巨无霸', price: 25.0, category: '汉堡', kcal: 540 },
    { code: 'BM002', name: '麦辣鸡腿堡', price: 22.5, category: '汉堡', kcal: 520 },
    { code: 'BM003', name: '板烧鸡腿堡', price: 22.5, category: '汉堡', kcal: 410 },
    { code: 'ST001', name: '巨无霸套餐', price: 39.0, category: '套餐', kcal: 1010 },
    { code: 'ST002', name: '麦辣鸡腿堡套餐', price: 36.0, category: '套餐', kcal: 990 },
    { code: 'ST003', name: '板烧鸡腿堡套餐', price: 36.0, category: '套餐', kcal: 880 },
    { code: 'CK001', name: '麦麦脆汁鸡 1 块', price: 15.0, category: '炸鸡', kcal: 290 },
    { code: 'CK002', name: '麦麦脆汁鸡 3 块', price: 39.0, category: '炸鸡', kcal: 870 },
    { code: 'CK003', name: '麦乐鸡分享盒 20 块', price: 49.0, category: '炸鸡', kcal: 920 },
    { code: 'SN001', name: '麦乐鸡 5 块', price: 13.5, category: '小食', kcal: 230 },
    { code: 'SN002', name: '中薯条', price: 12.0, category: '小食', kcal: 330 },
    { code: 'SN003', name: '麦辣鸡翅 2 块', price: 13.0, category: '小食', kcal: 260 },
    { code: 'DS001', name: '麦旋风 奥利奥', price: 15.0, category: '甜品', kcal: 340 },
    { code: 'DS002', name: '原味甜筒', price: 6.0, category: '甜品', kcal: 150 },
    { code: 'DS003', name: '菠萝派', price: 8.5, category: '甜品', kcal: 240 },
    { code: 'DR001', name: '中杯可口可乐', price: 9.5, category: '饮品', kcal: 140 },
    { code: 'DR003', name: '柠檬红茶(中)', price: 11.0, category: '饮品', kcal: 120 },
    // 拿铁沿用 DR002：旧分享链接里存的是编码
    { code: 'DR002', name: '麦咖啡 拿铁(中)', price: 18.0, category: '麦咖啡', kcal: 160 },
    { code: 'MC001', name: '麦咖啡 美式(中)', price: 14.0, category: '麦咖啡', kcal: 10 },
    { code: 'MC002', name: '麦咖啡 卡布奇诺(中)', price: 18.0, category: '麦咖啡', kcal: 150 },
  ],
  coupons: [
    { id: 'C1024', title: '程序员节 满100减24', type: 'threshold', threshold: 100, amount: 24 },
    { id: 'C0050', title: '满50减8', type: 'threshold', threshold: 50, amount: 8 },
    { id: 'CFRY', title: '中薯条 第二份半价', type: 'item', itemCode: 'SN002', amount: 6, perOrder: 1 },
    { id: 'CLATTE', title: '拿铁立减 5 元', type: 'item', itemCode: 'DR002', amount: 5, perOrder: 1 },
    { id: 'CSET', title: '巨无霸套餐立减 6 元', type: 'item', itemCode: 'ST001', amount: 6, perOrder: 1 },
    { id: 'C88', title: '全单 88 折(最高减 15)', type: 'percent', rate: 0.88, cap: 15 },
  ],
};
