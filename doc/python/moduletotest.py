print("n ?")
n = int(input())

print(1)

i = 1
while i < n:
    i += 1
    j = 2
    while j < i and i % j != 0:
        j += 1

    if j == i:
        print(i)
