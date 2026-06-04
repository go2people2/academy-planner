
def check_braces(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    stack = []
    for line_num, line in enumerate(lines, 1):
        for char_num, char in enumerate(line, 1):
            if char == '{':
                stack.append((line_num, char_num))
            elif char == '}':
                if not stack:
                    print(f"Extra '}}' at line {line_num}, col {char_num}")
                else:
                    stack.pop()
    
    if stack:
        print(f"Unclosed '{{':")
        for line_num, char_num in stack:
            print(f"  Line {line_num}, col {char_num}")
    else:
        print("Braces are balanced.")

if __name__ == "__main__":
    check_braces('/Users/joonsik_air/Documents/makeCode/academy-planner/app/[slug]/student/page.tsx')
