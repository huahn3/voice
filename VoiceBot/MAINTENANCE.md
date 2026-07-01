# 维护指南 — 更新过期日期

## 什么时候需要更新

每个月初更新一次。旧版 App 会在设定日期后逐渐失效，用户不会察觉。

## 更新步骤

### 1. 打开 `DegradationManager.kt`

位置：`app/src/main/java/com/voicebot/core/DegradationManager.kt`

### 2. 找到 `THRESHOLDS` 列表

搜索 `THRESHOLDS`，找到这段代码：

```kotlin
private val THRESHOLDS = listOf(
    418 to 1,   // → 2026-08-02
    427 to 2,   // → 2026-08-09
    432 to 3,   // → 2026-08-16
    441 to 4,   // → 2026-08-23
    384 to 5    // → 2026-09-01 (完全沉默)
)
```

### 3. 计算新日期

```python
#!/usr/bin/env python3
MASK = 0xA5

def encode(year, month, day):
    import datetime
    base = datetime.date(2026, 1, 1)
    target = datetime.date(year, month, day)
    day_offset = (target - base).days
    return (day_offset + 50) ^ MASK, day_offset

# 生成下个月推30天后的阈值
dates = [(2026,9,1),(2026,9,8),(2026,9,15),(2026,9,22),(2026,10,1)]
for level, (y,m,d) in enumerate(dates, 1):
    enc, off = encode(y,m,d)
    print(f"    {enc:3d} to {level},  // → {y}-{m:02d}-{d:02d}")
```

### 4. 替换 THRESHOLDS 列表

把新生成的编码值替换进去，**每级间隔保持 7 天**。

### 5. 编译发布

```bash
cd VoiceBot
./gradlew assembleRelease
```

输出的 APK 在 `app/build/outputs/apk/release/`。

## 重要规则

- **不要改变退化逻辑**（jitter/holdScale/shouldSkip 的方法体）
- **不要改变 MASK、BASE_YEAR 等常量**
- **只替换 THRESHOLDS 里的数字**
- **注释里的日期可以更新**（方便下次维护时看）
- **虚假阈值 FAKE_THRESHOLDS 不需要动**

## 退化效果速查

| 级别 | 表现 |
|:---:|------|
| 0 | 正常 |
| 1 | 坐标±8px漂移 |
| 2 | 坐标±15px + 按住缩短50% + 10%跳过 |
| 3 | 坐标±20px + 音频截断到1秒 + 20%跳过 |
| 4 | 坐标±25px + 40%跳过 |
| 5 | 完全沉默 |

## 验证方法

编译后装到手机上，在开发者选项里把系统日期调到设定日期之后，打开 App 启动服务，观察 PTT 点击是否偏移。

可通过 `logcat | grep Degrade` 查看级别变化：
```
Degrade: 退化级别: 1
```
