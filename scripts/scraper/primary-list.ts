// 112 首小学必背诗，按 1-6 年级上下册分组
// 顺序：title, dynasty, poetName（用于核对抓取结果是否匹配预期）
export interface PrimaryListEntry {
  title: string;
  dynasty: 'tang' | 'song' | 'ming' | 'qing' | 'modern' | 'other';
  poetName: string;
}

export const PRIMARY_LIST: PrimaryListEntry[] = [
  // 一年级上册
  { title: '咏鹅', dynasty: 'tang', poetName: '骆宾王' },
  { title: '江南', dynasty: 'other', poetName: '汉乐府' },
  { title: '画', dynasty: 'tang', poetName: '王维' },
  { title: '悯农', dynasty: 'tang', poetName: '李绅' }, // 其二
  { title: '古朗月行', dynasty: 'tang', poetName: '李白' }, // 节选
  { title: '风', dynasty: 'tang', poetName: '李峤' },
  // 一年级下册
  { title: '春晓', dynasty: 'tang', poetName: '孟浩然' },
  { title: '赠汪伦', dynasty: 'tang', poetName: '李白' },
  { title: '静夜思', dynasty: 'tang', poetName: '李白' },
  { title: '寻隐者不遇', dynasty: 'tang', poetName: '贾岛' },
  { title: '池上', dynasty: 'tang', poetName: '白居易' },
  { title: '小池', dynasty: 'song', poetName: '杨万里' },
  { title: '画鸡', dynasty: 'ming', poetName: '唐寅' },
  // 二年级上册
  { title: '梅花', dynasty: 'song', poetName: '王安石' },
  { title: '小儿垂钓', dynasty: 'tang', poetName: '胡令能' },
  { title: '登鹳雀楼', dynasty: 'tang', poetName: '王之涣' },
  { title: '望庐山瀑布', dynasty: 'tang', poetName: '李白' },
  { title: '江雪', dynasty: 'tang', poetName: '柳宗元' },
  { title: '夜宿山寺', dynasty: 'tang', poetName: '李白' },
  { title: '敕勒歌', dynasty: 'other', poetName: '北朝民歌' },
  // 二年级下册
  { title: '村居', dynasty: 'qing', poetName: '高鼎' },
  { title: '咏柳', dynasty: 'tang', poetName: '贺知章' },
  { title: '赋得古原草送别', dynasty: 'tang', poetName: '白居易' },
  { title: '晓出净慈寺送林子方', dynasty: 'song', poetName: '杨万里' },
  { title: '绝句', dynasty: 'tang', poetName: '杜甫' },
  { title: '舟夜书所见', dynasty: 'qing', poetName: '查慎行' },
  // 三年级上册
  { title: '所见', dynasty: 'qing', poetName: '袁枚' },
  { title: '山行', dynasty: 'tang', poetName: '杜牧' },
  { title: '赠刘景文', dynasty: 'song', poetName: '苏轼' },
  { title: '夜书所见', dynasty: 'song', poetName: '叶绍翁' },
  { title: '望天门山', dynasty: 'tang', poetName: '李白' },
  { title: '饮湖上初晴后雨', dynasty: 'song', poetName: '苏轼' },
  { title: '望洞庭', dynasty: 'tang', poetName: '刘禹锡' },
  { title: '早发白帝城', dynasty: 'tang', poetName: '李白' },
  { title: '采莲曲', dynasty: 'tang', poetName: '王昌龄' },
  // 三年级下册
  { title: '惠崇春江晚景', dynasty: 'song', poetName: '苏轼' },
  { title: '三衢道中', dynasty: 'song', poetName: '曾几' },
  { title: '忆江南', dynasty: 'tang', poetName: '白居易' },
  { title: '元日', dynasty: 'song', poetName: '王安石' },
  { title: '清明', dynasty: 'tang', poetName: '杜牧' },
  { title: '九月九日忆山东兄弟', dynasty: 'tang', poetName: '王维' },
  { title: '滁州西涧', dynasty: 'tang', poetName: '韦应物' },
  { title: '大林寺桃花', dynasty: 'tang', poetName: '白居易' },
  // 四年级上册
  { title: '鹿柴', dynasty: 'tang', poetName: '王维' },
  { title: '暮江吟', dynasty: 'tang', poetName: '白居易' },
  { title: '题西林壁', dynasty: 'song', poetName: '苏轼' },
  { title: '雪梅', dynasty: 'song', poetName: '卢钺' },
  { title: '嫦娥', dynasty: 'tang', poetName: '李商隐' },
  { title: '出塞', dynasty: 'tang', poetName: '王昌龄' },
  { title: '凉州词', dynasty: 'tang', poetName: '王翰' },
  { title: '夏日绝句', dynasty: 'song', poetName: '李清照' },
  { title: '别董大', dynasty: 'tang', poetName: '高适' },
  // 四年级下册
  { title: '宿建德江', dynasty: 'tang', poetName: '孟浩然' },
  { title: '六月二十七日望湖楼醉书', dynasty: 'song', poetName: '苏轼' },
  { title: '西江月·夜行黄沙道中', dynasty: 'song', poetName: '辛弃疾' },
  { title: '卜算子·送鲍浩然之浙东', dynasty: 'song', poetName: '王观' },
  { title: '清平乐·村居', dynasty: 'song', poetName: '辛弃疾' },
  { title: '独坐敬亭山', dynasty: 'tang', poetName: '李白' },
  { title: '乡村四月', dynasty: 'song', poetName: '翁卷' },
  { title: '四时田园杂兴', dynasty: 'song', poetName: '范成大' }, // 其二十五/其二
  { title: '墨梅', dynasty: 'other', poetName: '王冕' }, // 元代 · 日积月累
  { title: '芙蓉楼送辛渐', dynasty: 'tang', poetName: '王昌龄' }, // 课标 75 / 教材未编入
  { title: '塞下曲', dynasty: 'tang', poetName: '卢纶' }, // 课标 75 / 教材未编入
  { title: '蜂', dynasty: 'tang', poetName: '罗隐' }, // 课标 75 / 教材未编入
  // 五年级上册
  { title: '蝉', dynasty: 'tang', poetName: '虞世南' },
  { title: '乞巧', dynasty: 'tang', poetName: '林杰' },
  { title: '示儿', dynasty: 'song', poetName: '陆游' },
  { title: '题临安邸', dynasty: 'song', poetName: '林升' },
  { title: '己亥杂诗', dynasty: 'qing', poetName: '龚自珍' },
  { title: '山居秋暝', dynasty: 'tang', poetName: '王维' },
  { title: '枫桥夜泊', dynasty: 'tang', poetName: '张继' },
  { title: '长相思', dynasty: 'qing', poetName: '纳兰性德' },
  { title: '渔歌子', dynasty: 'tang', poetName: '张志和' },
  { title: '观书有感', dynasty: 'song', poetName: '朱熹' }, // 其一/其二
  // 五年级下册
  { title: '稚子弄冰', dynasty: 'song', poetName: '杨万里' },
  { title: '村晚', dynasty: 'song', poetName: '雷震' },
  { title: '鸟鸣涧', dynasty: 'tang', poetName: '王维' },
  { title: '凉州词', dynasty: 'tang', poetName: '王之涣' },
  { title: '送元二使安西', dynasty: 'tang', poetName: '王维' },
  { title: '秋夜将晓出篱门迎凉有感', dynasty: 'song', poetName: '陆游' },
  { title: '闻官军收河南河北', dynasty: 'tang', poetName: '杜甫' },
  { title: '长歌行', dynasty: 'other', poetName: '汉乐府' },
  { title: '寒菊', dynasty: 'song', poetName: '郑思肖' }, // 日积月累（之前错放 6下）
  { title: '黄鹤楼送孟浩然之广陵', dynasty: 'tang', poetName: '李白' }, // 课标 75 / 教材未编入
  { title: '江畔独步寻花', dynasty: 'tang', poetName: '杜甫' }, // 课标 75 / 教材未编入
  { title: '游子吟', dynasty: 'tang', poetName: '孟郊' }, // 课标 75 / 教材未编入
  // 六年级上册
  { title: '过故人庄', dynasty: 'tang', poetName: '孟浩然' },
  { title: '七律·长征', dynasty: 'modern', poetName: '毛泽东' },
  { title: '菩萨蛮·大柏地', dynasty: 'modern', poetName: '毛泽东' },
  { title: '春日', dynasty: 'song', poetName: '朱熹' },
  { title: '回乡偶书', dynasty: 'tang', poetName: '贺知章' },
  { title: '浪淘沙', dynasty: 'tang', poetName: '刘禹锡' },
  { title: '江南春', dynasty: 'tang', poetName: '杜牧' },
  { title: '书湖阴先生壁', dynasty: 'song', poetName: '王安石' },
  // 六年级下册
  { title: '寒食', dynasty: 'tang', poetName: '韩翃' },
  { title: '迢迢牵牛星', dynasty: 'other', poetName: '佚名' },
  { title: '十五夜望月', dynasty: 'tang', poetName: '王建' },
  { title: '马诗', dynasty: 'tang', poetName: '李贺' },
  { title: '石灰吟', dynasty: 'ming', poetName: '于谦' },
  { title: '竹石', dynasty: 'qing', poetName: '郑燮' },
  { title: '采薇', dynasty: 'other', poetName: '佚名' },
  { title: '春夜喜雨', dynasty: 'tang', poetName: '杜甫' },
  { title: '早春呈水部张十八员外', dynasty: 'tang', poetName: '韩愈' },
  { title: '江上渔者', dynasty: 'song', poetName: '范仲淹' },
  { title: '泊船瓜洲', dynasty: 'song', poetName: '王安石' },
  { title: '游园不值', dynasty: 'song', poetName: '叶绍翁' },
  { title: '浣溪沙', dynasty: 'song', poetName: '苏轼' },
  { title: '清平乐', dynasty: 'song', poetName: '黄庭坚' },
];
