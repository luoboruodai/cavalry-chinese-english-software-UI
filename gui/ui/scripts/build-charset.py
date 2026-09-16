#!/usr/bin/env python3
"""收集 MiSans 子集字符集:扫描 gui/ui/src 源码中的 CJK/全角标点 + 样张 + cbpatch 错误串 + 500 常用字兜底。"""
import pathlib
import re
import sys

SRC = pathlib.Path("/Users/vibecoding_prj/cavarly双语ui界面/cavalry-bilingual/gui/ui/src")
OUT = pathlib.Path("/tmp/misans-dl/charset.txt")

SAMPLES = "文件（File）编辑（Edit）撤销 %1（Undo %1）累加器（Accumulator）显示网格（Show Grid）欢迎使用 Cavalry（Welcome to Cavalry）"

# cbpatch 后端的错误/提示串(Tauri 会原样抛给 toast),保证动态文案也有字形
ERROR_STRINGS = (
    "无法确定目录请设置环境变量找不到应用注入请用指定默认已检查不支持的语言可选"
    "检测到正在运行请先退出保存好工作再执行此操作在没有找到任何备份创建"
    "重签失败校验生成时间戳写入读取配置不是合法序列化模板需包含或占位符"
    "提示可运行恢复恢复到最近一次备份状态可重试还原或手动从恢复文件"
    "已应用双语补丁原版英文社区中文运行时→备份已还原项移除还原失败"
    "应用保存读取构建信息字体差异化开启关闭排版已创建还原为所选版本"
)

# 常用汉字 500 兜底(去重后不足 500 无妨,UI 文案已被扫描覆盖)
COMMON = (
    "的一是不了在人有我他这中大来上国个到说们为子和你地出道也时年得就那要动各会自着下之生过家学去起么发用工"
    "如而然作多现于几年主平事十员三教向问开信话吗从呢四台前里气再此水先新听完本见位世儿北故花海表眼使高月些"
    "天它化她二关成回正后所经令机体字总海好无百把今心思路山见南带钱男间手知重六真风容貌旧空象记越十八住笑被"
    "解身老京第司长西瓜完声牙主又行意找低另流店远哥很提兴边满安服般快早即操块晚检望雪彩色绝密围境忠离愈系速"
    "弟复细歌转量哈反步换叶酸列犬秦瓦弹储岸予曲乘息敌穿睡休纳腹录磁寒谓乘急蒙船雨棒悟恐尖司纸藏岛羊败引弹"
    "跳喝采灯伤 keys 屋换港味牙横齿芬沙舰敏赖忠染尾粮钢够御灵敏"
    "啊吧呢吗嘛哦哪谁什么怎么这样那样可以可能应该因为所以如果但是而且或者然后已经正在将要没有不要非常比较"
    "真的确实其实特别还是就是都不也都还在再又也都很还太啦呀哪您欢迎请谢谢对不起麻烦请问帮助查看设置选项"
    "确认取消完成成功失败错误警告提示信息状态版本语言模板自定义实验功能当前正在处理中检测刷新还原应用安装"
    "补丁双语简体繁体中文英文日语字体差异注入渲染层生效未生效就绪未知暂无时间最新备份目录文件签名标识摘要"
    "权限合法环境变量占用退出执行操作核心库所有保存在路径执行前并保存好工作仅供学习用途与无关"
)

def is_cjk_or_wide(ch: str) -> bool:
    cp = ord(ch)
    return (
        0x2E80 <= cp <= 0x9FFF      # CJK 部首/标点/汉字
        or 0xF900 <= cp <= 0xFAFF   # 兼容汉字
        or 0xFF00 <= cp <= 0xFFEF   # 全角形式
        or 0x2010 <= cp <= 0x2027   # —–… 等
        or 0x2030 <= cp <= 0x205E   # ‰′″
        or ch in "·×"
    )

chars = set()
for path in SRC.rglob("*"):
    if path.suffix not in (".tsx", ".ts", ".css"):
        continue
    text = path.read_text(encoding="utf-8")
    for ch in text:
        if is_cjk_or_wide(ch):
            chars.add(ch)
for ch in SAMPLES + ERROR_STRINGS + COMMON:
    if is_cjk_or_wide(ch):
        chars.add(ch)

OUT.write_text("".join(sorted(chars)), encoding="utf-8")
print(f"charset: {len(chars)} unique chars -> {OUT}")
