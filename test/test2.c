#include <stdio.h>
#include <stdlib.h>

int  main (int argc,int **argv) {
  int a;


   int b;

  char *bar;
                      printf("test"); // test qui est un peu long pour être vraiment découpé mais en même temps j'aimerais bien que ça le soit automatiquement histoire de s'assurer que AStyle fonctionne attends mais cette ligne est longue
  printf("test2");
  if (1) 
    printf("test3", "test4", "test5", 6); 
  else {
    if (2) {
      printf("yolo");
    }
  }
}

int main2(int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, int k, int l, int m, int n) {
  printf("test2");
}
