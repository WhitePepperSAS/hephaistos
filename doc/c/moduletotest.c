// !!! AUCUN DES COMMENTAIRES INDIQUES DANS CE DOCUMENT NE DOIT ETRE MODIFIE !!!
// IL EST IMPERATIF D’ECRIRE VOS FONCTIONS ET STRUCTURES DANS LES LIMITES
// INDIQUEES DANS LE PRESENT FICHIER

#include <stdio.h>
#include <stdlib.h>

// [[[ EX1 DEFINISSEZ VOTRE FONCTION operation SOUS CE COMMENTAIRE

int operation(int a, int b) {
  return a * a + b * 4;
}

// ]]] EX1 FIN DE LA FONCTION operation

// [[[ EX2 DEFINISSEZ VOTRE FONCTION est_valide SOUS CE COMMENTAIRE


// ]]] EX2 FIN DE LA FONCTION est_valide

// [[[ EX3,EX4 DEFINISSEZ VOTRE STRUCTURE Vaisseau SOUS CE COMMENTAIRE

// ]]] EX3,EX4 FIN DE LA STRUCTURE Vaisseau

// [[[ EX3 DEFINISSEZ VOTRE FONCTION verif_vaisseau SOUS CE COMMENTAIRE

// ]]] EX3 FIN DE LA FONCTION verif_vaisseau

// [[[ EX4 DEFINISSEZ VOTRE FONCTION cherche_vaisseau SOUS CE COMMENTAIRE

// ]]] EX4 FIN DE LA FONCTION cherche_vaisseau

int main() {
  printf("operation résultat: %d", operation(1, 2));
  return 0;
}
