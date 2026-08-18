
def trace_braces(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    stack = []
    for line_num, line in enumerate(lines, 1):
        for char_num, char in enumerate(line, 1):
            if char == '{':
                stack.append((line_num, char_num, line.strip()))
            elif char == '}':
                if not stack:
                    print(f"Extra '}}' at line {line_num}, col {char_num}: {line.strip()}")
                else:
                    stack.pop()
        # print(f"Line {line_num}: depth {len(stack)}")
        if line_num == 210:
             print(f"Depth at line 210: {len(stack)}")
             for l, c, cont in stack:
                 print(f"  Still open: Line {l}, col {c}: {cont}")

if __name__ == "__main__":
    trace_braces('/Users/joonsik_air/Documents/makeCode/academy-planner/app/[slug]/student/page.tsx')
