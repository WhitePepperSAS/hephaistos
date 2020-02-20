#define UNITY_INCLUDE_CONFIG_H
#include "unity.h"

void setUp(void) { /* setup stuff here */  }
void tearDown(void) { /* cleanup stuff here */ }

int test_operation_with_2_3(void) {
  TEST_ASSERT_EQUAL_INT(2 * 2 + 3 * 4, operation(2, 3));
}

int test_operation_with_5_10(void) {
  TEST_ASSERT_EQUAL_INT(5 * 5 + 10 * 4, operation(5, 10));
}

int test_operation_with_m5_10(void) {
  TEST_ASSERT_EQUAL_INT(-5 * -5 + 10 * 4, operation(-5, 10));
}

int test_operation_with_30_m100(void) {
  TEST_ASSERT_EQUAL_INT(30 * 30 + (-100 * 4), operation(30, -100));
}

int main(void) {
  UNITY_BEGIN();
  RUN_TEST(test_operation_with_2_3);
  RUN_TEST(test_operation_with_5_10);
  RUN_TEST(test_operation_with_m5_10);
  RUN_TEST(test_operation_with_30_m100);
  return UNITY_END();
}
