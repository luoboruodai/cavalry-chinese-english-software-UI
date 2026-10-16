#pragma once
// Qt 6.9.2's qYieldCpu selects __yield with Apple Clang but does not include
// its ACLE declaration. Pre-include the compiler header, not a patched Qt SDK.
#if defined(__APPLE__) && (defined(__arm64__) || defined(__aarch64__))
#include <arm_acle.h>
#endif
