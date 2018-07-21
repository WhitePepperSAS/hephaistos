#include <stdio.h>
#include <stdlib.h>

int main(int argc, int** argv)
{
  int a = 1;
  int b = 2;

  if (a < b || 
      b > a) {
    printf("a != b\n");
  }
}
