#ifndef UNITY_CONFIG_H
#define UNITY_CONFIG_H
#include <stdio.h>

// const char __TEST_FILE_PATH[] = "output_test.txt";
#define UNITY_OUTPUT_CHAR(a)                  __print_to_file(a)
#define UNITY_OUTPUT_CHAR_HEADER_DECLARATION  __print_to_file(int)
#define UNITY_OUTPUT_FLUSH()                  __flush_file()
#define UNITY_OUTPUT_FLUSH_HEADER_DECLARATION __flush_file()
#define UNITY_OUTPUT_START()                  __open_file_fd()
#define UNITY_OUTPUT_COMPLETE()               __close_file_fd()


FILE *__test_fd = NULL;

void __print_to_file(int c) {
  if (__test_fd) {
    fprintf(__test_fd, "%c", c);
  }
}

void __flush_file() {
  if (__test_fd) {
    fflush(__test_fd);
  }
}

void __open_file_fd() {
  if (!__test_fd) {
    __test_fd = fopen(__TEST_FILE_PATH, "w");
  }
}

void __close_file_fd() {
  if (__test_fd) {
    fclose(__test_fd);
    __test_fd = NULL;
  }
}

#endif // UNITY_CONFIG_H
