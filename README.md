# ARG · Arknights Rogue Generator

《明日方舟》集成战略（肉鸽）随机开局生成器，项目代号 **ARG**。桌面端与安卓端，同一个种子得到同一个结果。

同一份「干员 ID + 日期」永远抽出同一套开局，所以它适合用来和朋友对同一个种子，也适合每天抽一次当作当天的课题。

## 功能

- **开局生成器** —— 按当前启用的主题抽取今日开局：开局主题、开局分队、开局干员、被禁用的干员，以及各职业抓位。
- **仙术杯赛制** —— 收录仙术杯 #1 至 #9（含 #1.5、#2.5），每届锁定自己的主题与禁选规则。
- **通天国际联赛** —— #1 限定水月与深蓝之树；#2 限定探索者的银凇止境，并固定禁用 17 位干员。
- **老缠杯** —— #1 限定探索者的银凇止境（老鲤与琳琅诗怀雅的权重是其他干员的 5 倍）、#2 限定萨卡兹的无终奇语（抽 12 位）、#3 限定界园志异（抽 10 位）；整局只能使用抽出的那几位六星。
- **四个 BP 档位** —— 开局 / 4 BP / 8 BP / 16 BP，档位越高禁用池越大。
- **干员池** —— 六星干员 137 名，可逐个标记「没有」或「已拥有不可使用」，也可以从 MAA 导出的干员 JSON 一键导入。
- **头像模式** —— 可以在干员列表里用头像代替名字；被禁用、以及不在 box 里的干员会盖一层灰色遮罩。
- **导出结果** —— 一键复制成 `ID：… 主题：… 分队：… 开局干员：…` 的格式，方便贴给别人。
- **个人资料** —— 自定义 ID 与头像，头像从干员头像库里选。
- **历史记录** —— 保留最近 50 次生成；「抽取开局」不入库，BP 档位都会记录。
- **中英双语** —— 界面与生成结果都可切换英文，干员名、主题名用官方英译。语言在「设置 → 语言」里单独设置，和主题配色互不影响。

## 下载

到 [Releases](https://github.com/Rosmontis220/ArknightsRogueGenerator_Tauri/releases) 取最新版本：

| 平台 | 文件 |
| --- | --- |
| Windows（免安装） | `ArknightsRogueGenerator.exe` |
| Windows（安装） | `ArknightsRogueGenerator_<版本>_x64-setup.exe` 或 `..._x64_zh-CN.msi` |
| Android | `ArknightsRogueGenerator_<版本>.apk` |

文件名是 ASCII 的，这不是笔误：GitHub 会把 Release 资源名里的非 ASCII 字符直接删掉，中文名传上去会被削成 `_0.1.0.apk` 这种。所以中文放在资源的 label 上，Release 页面照常显示中文说明。

Windows 免安装版是单文件绿色版，双击即用，不写注册表。安卓端需要 Android 7.0（API 24）及以上。

## 技术栈

| | |
| --- | --- |
| 壳 | Tauri 2（Rust） |
| 前端 | SvelteKit + Svelte 5（runes）+ TypeScript |
| 样式 | Tailwind CSS v4 |
| 打包 | `adapter-static`，纯静态产物，无服务端 |

Rust 侧只负责持久化：把状态原子地写到应用数据目录下的 `state.json`。所有生成逻辑都在前端，不联网。

## 开发

需要 Node.js 20+、pnpm、Rust 工具链，以及 Tauri 的系统依赖（见 [Tauri 前置要求](https://tauri.app/start/prerequisites/)）。

```sh
pnpm install
pnpm tauri dev
```

类型检查与构建：

```sh
pnpm check      # svelte-check
pnpm build      # 前端产物到 build/
```

## 打包

### 桌面端

```sh
pnpm tauri build
```

产物在 `src-tauri/target/release/bundle/`：`msi/` 与 `nsis/` 各一份安装包。单文件绿色版是 `src-tauri/target/release/arknights-rogue-generator.exe`——文件名来自 Cargo 的包名，拷出来改成 `ArknightsRogueGenerator.exe` 不影响运行。

### 安卓端

还需要 JDK 17+、Android SDK（platform 36、build-tools）与 NDK（23.1.7779620 实测可用）。

```sh
pnpm tauri android init     # 首次，生成 gen/android
pnpm tauri android build --apk
```

产物在 `src-tauri/gen/android/app/build/outputs/apk/`。发布用的 APK 需要用你自己的 keystore 签名：把 `storeFile` / `storePassword` / `keyAlias` / `keyPassword` 写进 `src-tauri/gen/android/keystore.properties`（已被 git 忽略），`app/build.gradle.kts` 会自动读取；没有这个文件也能构建，只是产物未签名。

注意 `storeFile` 请用纯 ASCII 路径：Gradle 用 `Properties.load(InputStream)` 读这个文件，按 ISO-8859-1 解码，非 ASCII 路径会变成乱码、构建时找不到 keystore。

`gen/android/` 随仓库提供，里面固定了 build-tools `36.0.0`——AGP 8.11 默认要 35.0.0，没装就会直接报 `Failed to find Build Tools revision 35.0.0`。你本机装的版本不同的话，改 `gen/android/app/build.gradle.kts` 与 `gen/android/build.gradle.kts` 里的 `buildToolsVersion`。

## 目录结构

```
src/
  lib/
    core/         干员表、主题表、种子推导、SHA-256
    generators/   各赛制的生成逻辑，registry.ts 是唯一的总表
    i18n/         中英词条与显示边界上的本地化
    stores/       应用状态、历史记录
  routes/
    splash/       开屏
    home/         首页、生成、历史、设置
  static/avatars/ 137 位六星干员的头像，文件名是干员 id
src-tauri/        Rust 侧：窗口配置、持久化命令、图标
```

生成器全部由 `src/lib/generators/registry.ts` 登记，生成页照着这份表渲染。新增一个赛制 = 加一个模块 + 在表里加一行，不需要改任何界面代码。

## 结果是怎么定下来的

每次生成只由一个 32 位种子驱动：

```
seed = parseInt(sha256(干员ID + "_" + 日期).slice(0, 8), 16)
```

之后每一步选择都取 `hash % 候选数`，所以同一份输入永远得到同一个结果，且不依赖任何随机数发生器或系统时间。

哈希用的是 SHA-256。早先的版本用的是 MD5，换成 SHA-256 之后同一份「ID + 日期」得到的结果和之前不同——这是一次有意的算法更换。

## 数据

干员、主题、分队等数据以中文存放在源码里，本地化发生在显示边界上（`t()` 与 `localize*`），生成逻辑本身不碰语言。英文干员名与主题名采用官方客户端的译名。

## 许可证

[MIT](LICENSE)。

---

## English

**ARG** (Arknights Rogue Generator) is a random run generator for *Arknights* Integrated Strategies. Desktop (Tauri 2 + SvelteKit) and Android, in Chinese and English.

Every result is derived from a single 32-bit seed — `sha256(playerId + "_" + date)` — so the same ID and date always produce the same run, with no random number generator and no network access involved. (Earlier versions used MD5, so results differ from those versions; the switch to SHA-256 was deliberate.)

It covers the opening generator, Theurgy Cup #1–#9, Skywalking Global League #1–#2, and LAO CHAN BEI #1–#3, plus 4/8/16 ban-pick sizes, a 137-operator box with MAA import, portrait mode, result export, a custom profile picture, and a 50-run history.
