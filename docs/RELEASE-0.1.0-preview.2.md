# Cavalry Bilingual 0.1.0 Preview 2

**简体中文** | [English](#english)

> 这是预发布，不是稳定版。Windows 主安装入口已改为 NSIS `setup.exe`；附件用于提前试用和问题反馈，不代表全界面、全版本或全平台验收完成。

## 中文

### 附件与校验

| 附件 | SHA-256 |
|---|---|
| `Cavalry-Bilingual_0.1.0-preview.2_macOS-universal.dmg` | `531227977b5f9c123567a9dd66e490006585893d1854bc99d181119cd1ad464a` |
| `Cavalry-Bilingual_0.1.0-preview.2_Windows-x64-setup.exe` | `56359d45b76d40fb4ec8af5d1876074583c9c5ae7e2c7a105359f17a97731776` |

同时提供 `SHA256SUMS.txt`。GitHub 自动生成的 Source code 是源码快照，不是安装包。

### macOS universal DMG

- 包含 arm64 + x86_64 GUI、内置 runtime、Preview 2 双语离线安装指南和许可文件。
- 主程序 SHA-256：`9b2544eafab9c01425fc37a440cb86cc652ea805a3daf18c5f1c580843a338db`。
- runtime SHA-256：`f41510a23ca0825a18d0c4928fbfc413d63d68268a00a06048f9f8ab3be8c99f`。
- 已执行 DMG 挂载、CRC、deep/strict 签名、架构、成员和隐私检查；挂载内容 9 个文件/blob，0 个隐私标记。
- ad-hoc 签名，未公证；Intel 原生硬件仍未验收。

### Windows x64 NSIS 安装器

- `setup.exe` 是 Nullsoft Installer self-extracting archive，包含 PE x64 GUI、generic/QPA 两个当前 DLL、双语 `INSTALL.txt` 和 Legal 文件。
- 主程序 SHA-256：`7b0e5a1605d4be4955dd915e857e15bd35da42d0b18126c91d94d5747a19f678`。
- generic DLL：`a79f03f67a9e2be119125d7563c065723af6ad9db835a7bb9559ec4d5ecb28cd`。
- QPA DLL：`51f0722ae56b26ba6ab3ebc7dd01b622f4e6aac842b7d8d8b5f2a88fd03965a1`。
- 已通过 7-Zip 直接核对 NSIS 成员与解压后文件：GUI、runtime、INSTALL 和 Legal 均存在，指南/许可/运行时字节一致；安装器本身隐私扫描 0 标记。
- 主程序扫描仍有同一组 `credential_url` 机器码误报，含 NUL/高位字节，已按精确产物与匹配字节哈希人工复核；其他规则无命中，扫描规则未放宽。
- **安装器未签名。** 需要 Windows x64 和可用的 WebView2 Runtime。
- 在 macOS 上交叉构建；原生 Windows、MSVC 和真实 Cavalry 宿主未验收。Wine 静默安装未完成且未生成目标目录，未记为通过。

### 使用与剩余边界

1. 先保存工程并自行退出 Cavalry，再按包内 `INSTALL.txt` 使用。
2. 只在状态页检测与宿主安全合同匹配时应用；需要回退时选择对应快照。
3. Cavalry 2.8 正式写入仍被拒绝；全界面、其他 Canvas/Graph/TrackingTool、非白名单提示及 Intel 原生仍未完成。
4. 本次没有 CI 运行结果可用于证明附件正确，以上结论来自本地构建、包装和回读检查。

## English

This is a pre-release, not a stable release. The primary Windows installation entry is now an NSIS `setup.exe`. The packages are provided for early evaluation and feedback; they do not establish full-UI, all-version, or all-platform acceptance.

### Attachments and checksums

The two attachments and hashes listed above are provided, together with `SHA256SUMS.txt`. GitHub's automatic Source code archives are source snapshots, not installers.

### macOS universal DMG

- Contains the arm64 + x86_64 GUI, bundled runtime, Preview 2 bilingual offline guide, and license notices.
- Main executable: `9b2544eafab9c01425fc37a440cb86cc652ea805a3daf18c5f1c580843a338db`.
- Runtime: `f41510a23ca0825a18d0c4928fbfc413d63d68268a00a06048f9f8ab3be8c99f`.
- Verified by DMG mounting, CRC, deep/strict signature checks, architecture checks, member checks, and privacy scans: 9 files/blobs, 0 findings.
- Ad-hoc signed and not notarized. Native Intel hardware remains unverified.

### Windows x64 NSIS installer

- The setup is a Nullsoft self-extracting archive containing the PE x64 GUI, current generic/QPA DLLs, bilingual `INSTALL.txt`, and Legal files.
- Main executable: `7b0e5a1605d4be4955dd915e857e15bd35da42d0b18126c91d94d5747a19f678`.
- Generic DLL: `a79f03f67a9e2be119125d7563c065723af6ad9db835a7bb9559ec4d5ecb28cd`.
- QPA DLL: `51f0722ae56b26ba6ab3ebc7dd01b622f4e6aac842b7d8d8b5f2a88fd03965a1`.
- 7-Zip verification confirmed every required member and extracted byte. The installer itself has 0 privacy findings. The payload has the same exact machine-code `credential_url` false positive, manually reviewed by artifact and matched-byte hash; no scanner rule was relaxed.
- **Unsigned.** Windows x64 and a working WebView2 Runtime are required.
- Cross-built on macOS. Native Windows, MSVC, and real Cavalry host acceptance are incomplete. Wine silent installation did not complete or create the target directory and is not recorded as passed.

### Usage and remaining boundaries

1. Save your project and quit Cavalry before following the package's `INSTALL.txt`.
2. Apply only when Status detection and host safety contracts match. Restore to a selected snapshot when needed.
3. Production writes for Cavalry 2.8 remain blocked. Full-UI coverage, other Canvas/Graph/TrackingTool paths, non-whitelisted hints, and native Intel acceptance remain incomplete.
4. No CI run is available as evidence for these attachments; the results above come from local build, packaging, and read-back checks.
