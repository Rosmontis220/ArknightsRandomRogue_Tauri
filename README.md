# 方舟随机肉鸽生成器

《明日方舟》集成战略（肉鸽）随机开局生成器。桌面端与安卓端，同一个种子得到同一个结果。

同一份「干员 ID + 日期」永远抽出同一套开局，所以它适合用来和朋友对同一个种子，也适合每天抽一次当作当天的课题。

## 功能

- **开局生成器** —— 按当前启用的主题抽取今日开局：开局主题、开局分队、开局干员、被禁用的干员，以及各职业抓位。
- **仙术杯赛制** —— 收录仙术杯 #1 至 #9 各届数（含 #1.5、#2.5），每届锁定自己的主题与禁选规则。
- **老缠杯 #2**。
- **四个 BP 档位** —— 开局 / 4 BP / 8 BP / 16 BP，档位越高禁用池越大。
- **干员池** —— 六星干员 137 名，可逐个标记「没有」以把不在你 box 里的干员排除出去。
- **历史记录** —— 每次生成都会留档，可回看与删除。
- **中英双语** —— 界面与生成结果都可切换英文，干员名、主题名用官方英译。

## 下载

到 [Releases](https://github.com/Rosmontis220/ArknightsRandomRogue_Tauri/releases) 取最新版本：

| 平台 | 文件 |
| --- | --- |
| Windows（免安装） | `方舟随机肉鸽生成器.exe` |
| Windows（安装） | `方舟随机肉鸽生成器_<版本>_x64-setup.exe` 或 `.msi` |
| Android | `方舟随机肉鸽生成器_<版本>.apk` |

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

产物在 `src-tauri/target/release/bundle/`：`msi/` 与 `nsis/` 各一份安装包。单文件绿色版是 `src-tauri/target/release/kaiju-tauri.exe`——文件名来自 Cargo 的包名，拷出来改成产品名不影响运行。

### 安卓端

还需要 JDK 17+、Android SDK（platform 36、build-tools）与 NDK（23.1.7779620 实测可用）。

```sh
pnpm tauri android init     # 首次，生成 gen/android
pnpm tauri android build --apk
```

产物在 `src-tauri/gen/android/app/build/outputs/apk/`。发布用的 APK 需要用你自己的 keystore 签名：把 `storeFile` / `storePassword` / `keyAlias` / `keyPassword` 写进 `src-tauri/gen/android/keystore.properties`（已被 git 忽略），`app/build.gradle.kts` 会自动读取；没有这个文件也能构建，只是产物未签名。

`gen/android/` 随仓库提供，里面固定了 build-tools `36.0.0`——AGP 8.11 默认要 35.0.0，没装就会直接报 `Failed to find Build Tools revision 35.0.0`。你本机装的版本不同的话，改 `gen/android/app/build.gradle.kts` 与 `gen/android/build.gradle.kts` 里的 `buildToolsVersion`。

## 目录结构

```
src/
  lib/
    core/         干员表、主题表、种子推导、MD5
    generators/   各赛制的生成逻辑，registry.ts 是唯一的总表
    i18n/         中英词条与显示边界上的本地化
    stores/       应用状态、历史记录
  routes/
    splash/       开屏
    home/         首页、生成、历史、设置
src-tauri/        Rust 侧：窗口配置、持久化命令、图标
```

生成器全部由 `src/lib/generators/registry.ts` 登记，生成页照着这份表渲染。新增一个赛制 = 加一个模块 + 在表里加一行，不需要改任何界面代码。

## 结果是怎么定下来的

每次生成只由一个 32 位种子驱动：

```
seed = parseInt(md5(干员ID + "_" + 日期).slice(0, 8), 16)
```

之后每一步选择都取 `hash % 候选数`，所以同一份输入永远得到同一个结果，且不依赖任何随机数发生器或系统时间。

## 数据

干员、主题、分队等数据以中文存放在源码里，本地化发生在显示边界上（`t()` 与 `localize*`），生成逻辑本身不碰语言。英文干员名与主题名采用官方客户端的译名。

## 许可证

[MIT](LICENSE)。

---

## English

A random run-generator for *Arknights* Integrated Strategies. Desktop (Tauri 2 + SvelteKit) and Android, in Chinese and English.

Every result is derived from a single 32-bit seed — `md5(playerId + "_" + date)` — so the same ID and date always produce the same run, with no random number generator and no network access involved.
