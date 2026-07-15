// 86 首初中必背古诗词，按 7-9 年级上下册分组（统编版 2024）。
// 顺序：title, dynasty, poetName（用于核对抓取结果是否匹配预期）。
// dynasty 与 primary-list.ts 对齐：'tang'|'song'|'ming'|'qing'|'modern'|'other'（含汉魏晋南北朝元）。
export type JuniorDynasty = 'tang' | 'song' | 'ming' | 'qing' | 'modern' | 'other';

export interface JuniorListEntry {
  title: string;
  dynasty: JuniorDynasty;
  poetName: string;
}

// gradeBand 字段：与 data/grades.ts 的 JUNIOR_BANDS 对齐。
// '7a'=七上 / '7b'=七下 / '8a'=八上 / '8b'=八下 / '9a'=九上 / '9b'=九下。
export type JuniorBand = '7a' | '7b' | '8a' | '8b' | '9a' | '9b';

export interface JuniorListSection {
  band: JuniorBand;
  entries: JuniorListEntry[];
}

export const JUNIOR_LIST: JuniorListSection[] = [
  // ——————————————————— 七年级上册（12 首）———————————————————
  {
    band: '7a',
    entries: [
      // 课文·古代诗歌四首
      { title: '观沧海', dynasty: 'other', poetName: '曹操' }, // 汉
      { title: '次北固山下', dynasty: 'tang', poetName: '王湾' },
      { title: '闻王昌龄左迁龙标遥有此寄', dynasty: 'tang', poetName: '李白' },
      { title: '天净沙·秋思', dynasty: 'other', poetName: '马致远' }, // 元
      // 课外古诗词诵读（上）
      { title: '峨眉山月歌', dynasty: 'tang', poetName: '李白' },
      { title: '江南逢李龟年', dynasty: 'tang', poetName: '杜甫' },
      { title: '行军九日思长安故园', dynasty: 'tang', poetName: '岑参' },
      { title: '夜上受降城闻笛', dynasty: 'tang', poetName: '李益' },
      // 课外古诗词诵读（下）
      { title: '秋词', dynasty: 'tang', poetName: '刘禹锡' }, // 其一
      { title: '夜雨寄北', dynasty: 'tang', poetName: '李商隐' },
      { title: '十一月四日风雨大作', dynasty: 'song', poetName: '陆游' }, // 其二
      { title: '潼关', dynasty: 'qing', poetName: '谭嗣同' },
    ],
  },

  // ——————————————————— 七年级下册（14 首）———————————————————
  {
    band: '7b',
    entries: [
      // 课文古诗（6）
      { title: '木兰诗', dynasty: 'other', poetName: '北朝民歌' },
      { title: '登幽州台歌', dynasty: 'tang', poetName: '陈子昂' },
      { title: '望岳', dynasty: 'tang', poetName: '杜甫' },
      { title: '登飞来峰', dynasty: 'song', poetName: '王安石' },
      { title: '游山西村', dynasty: 'song', poetName: '陆游' },
      { title: '己亥杂诗', dynasty: 'qing', poetName: '龚自珍' }, // 其五，与小学库重复
      // 课外古诗词诵读（上）
      { title: '竹里馆', dynasty: 'tang', poetName: '王维' },
      { title: '春夜洛城闻笛', dynasty: 'tang', poetName: '李白' },
      { title: '逢入京使', dynasty: 'tang', poetName: '岑参' },
      { title: '晚春', dynasty: 'tang', poetName: '韩愈' },
      // 课外古诗词诵读（下）
      { title: '泊秦淮', dynasty: 'tang', poetName: '杜牧' },
      { title: '贾生', dynasty: 'tang', poetName: '李商隐' },
      { title: '过松源晨炊漆公店', dynasty: 'song', poetName: '杨万里' }, // 其五
      { title: '约客', dynasty: 'song', poetName: '赵师秀' },
    ],
  },

  // ——————————————————— 八年级上册（18 首）———————————————————
  {
    band: '8a',
    entries: [
      // 课文古诗（5）
      { title: '野望', dynasty: 'tang', poetName: '王绩' },
      { title: '黄鹤楼', dynasty: 'tang', poetName: '崔颢' },
      { title: '使至塞上', dynasty: 'tang', poetName: '王维' },
      { title: '渡荆门送别', dynasty: 'tang', poetName: '李白' },
      { title: '钱塘湖春行', dynasty: 'tang', poetName: '白居易' },
      // 课外古诗词诵读（上）：古诗十九首 + 建安文学
      { title: '庭中有奇树', dynasty: 'other', poetName: '佚名' }, // 古诗十九首·汉
      { title: '龟虽寿', dynasty: 'other', poetName: '曹操' }, // 汉
      { title: '赠从弟', dynasty: 'other', poetName: '刘桢' }, // 汉·其二
      { title: '梁甫行', dynasty: 'other', poetName: '曹植' }, // 汉
      // 课文古诗（3）
      { title: '饮酒', dynasty: 'other', poetName: '陶渊明' }, // 晋·其五
      { title: '春望', dynasty: 'tang', poetName: '杜甫' },
      { title: '雁门太守行', dynasty: 'tang', poetName: '李贺' },
      // 课外古诗词诵读（下）：唐宋名篇
      { title: '赤壁', dynasty: 'tang', poetName: '杜牧' },
      { title: '渔家傲', dynasty: 'song', poetName: '李清照' }, // 天接云涛连晓雾
      { title: '浣溪沙', dynasty: 'song', poetName: '晏殊' }, // 一曲新词酒一杯
      { title: '采桑子', dynasty: 'song', poetName: '欧阳修' }, // 轻舟短棹西湖好
      { title: '相见欢', dynasty: 'song', poetName: '朱敦儒' }, // 金陵城上西楼
      { title: '如梦令', dynasty: 'song', poetName: '李清照' }, // 常记溪亭日暮
    ],
  },

  // ——————————————————— 八年级下册（13 首）———————————————————
  {
    band: '8b',
    entries: [
      // 课文古诗《诗经》二首
      { title: '关雎', dynasty: 'other', poetName: '佚名' }, // 诗经·周南
      { title: '蒹葭', dynasty: 'other', poetName: '佚名' }, // 诗经·秦风
      // 课外古诗词诵读（上）：诗经 + 唐
      { title: '式微', dynasty: 'other', poetName: '佚名' }, // 诗经·邶风
      { title: '子衿', dynasty: 'other', poetName: '佚名' }, // 诗经·郑风
      { title: '送杜少府之任蜀州', dynasty: 'tang', poetName: '王勃' },
      { title: '望洞庭湖赠张丞相', dynasty: 'tang', poetName: '孟浩然' },
      // 课文古诗（3）
      { title: '茅屋为秋风所破歌', dynasty: 'tang', poetName: '杜甫' },
      { title: '卖炭翁', dynasty: 'tang', poetName: '白居易' },
      { title: '题破山寺后禅院', dynasty: 'tang', poetName: '常建' },
      // 课外古诗词诵读（下）：唐宋
      { title: '送友人', dynasty: 'tang', poetName: '李白' },
      { title: '卜算子·黄州定慧院寓居作', dynasty: 'song', poetName: '苏轼' },
      { title: '卜算子·咏梅', dynasty: 'song', poetName: '陆游' },
      // 课文词（1）
      { title: '卜算子·我住长江头', dynasty: 'modern', poetName: '李之仪' },
    ],
  },

  // ——————————————————— 九年级上册（12 首）———————————————————
  {
    band: '9a',
    entries: [
      // 课文诗词三首
      { title: '沁园春·雪', dynasty: 'modern', poetName: '毛泽东' },
      { title: '行路难', dynasty: 'tang', poetName: '李白' }, // 其一
      { title: '酬乐天扬州初逢席上见赠', dynasty: 'tang', poetName: '刘禹锡' },
      { title: '水调歌头', dynasty: 'song', poetName: '苏轼' }, // 明月几时有
      // 课外古诗词诵读（上）
      { title: '月夜忆舍弟', dynasty: 'tang', poetName: '杜甫' },
      { title: '长沙过贾谊宅', dynasty: 'tang', poetName: '刘长卿' },
      { title: '左迁至蓝关示侄孙湘', dynasty: 'tang', poetName: '韩愈' },
      { title: '商山早行', dynasty: 'tang', poetName: '温庭筠' },
      // 课外古诗词诵读（下）
      { title: '咸阳城东楼', dynasty: 'tang', poetName: '许浑' },
      { title: '无题', dynasty: 'tang', poetName: '李商隐' }, // 相见时难别亦难
      { title: '行香子', dynasty: 'song', poetName: '秦观' }, // 树绕村庄
      { title: '丑奴儿·书博山道中壁', dynasty: 'song', poetName: '辛弃疾' },
    ],
  },

  // ——————————————————— 九年级下册（17 首）———————————————————
  {
    band: '9b',
    entries: [
      // 课文·词四首
      { title: '渔家傲·秋思', dynasty: 'song', poetName: '范仲淹' },
      { title: '江城子·密州出猎', dynasty: 'song', poetName: '苏轼' },
      { title: '破阵子·为陈同甫赋壮词以寄之', dynasty: 'song', poetName: '辛弃疾' },
      { title: '满江红', dynasty: 'qing', poetName: '秋瑾' }, // 小住京华
      // 课文·诗词曲五首
      { title: '十五从军征', dynasty: 'other', poetName: '汉乐府' },
      { title: '白雪歌送武判官归京', dynasty: 'tang', poetName: '岑参' },
      { title: '南乡子·登京口北固亭有怀', dynasty: 'song', poetName: '辛弃疾' },
      { title: '过零丁洋', dynasty: 'song', poetName: '文天祥' },
      { title: '山坡羊·潼关怀古', dynasty: 'other', poetName: '张养浩' }, // 元
      // 课外古诗词诵读（上）
      { title: '定风波', dynasty: 'song', poetName: '苏轼' }, // 莫听穿林打叶声
      { title: '临江仙·夜登小阁忆洛中旧游', dynasty: 'song', poetName: '陈与义' },
      { title: '太常引·建康中秋夜为吕叔潜赋', dynasty: 'song', poetName: '辛弃疾' },
      { title: '浣溪沙', dynasty: 'qing', poetName: '纳兰性德' }, // 身向云山那畔行
      // 课外古诗词诵读（下）
      { title: '南安军', dynasty: 'song', poetName: '文天祥' },
      { title: '别云间', dynasty: 'qing', poetName: '夏完淳' },
      { title: '山坡羊·骊山怀古', dynasty: 'other', poetName: '张养浩' }, // 元
      { title: '朝天子·咏喇叭', dynasty: 'ming', poetName: '王磬' },
    ],
  },
];

// 验证总数 = 86。
export const JUNIOR_LIST_TOTAL = JUNIOR_LIST.reduce(
  (sum, section) => sum + section.entries.length,
  0,
);
