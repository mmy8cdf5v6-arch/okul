#!/usr/bin/env python3
"""Okul — kaynak parçalarını assets/ altına derler."""
import os, re, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["core.js", "charts.js", "course.js", "study.js", "home.js", "boot.js"]


def src(name):
    with open(os.path.join(HERE, "src", name), encoding="utf-8") as f:
        return f.read()


def main():
    os.makedirs(os.path.join(HERE, "assets"), exist_ok=True)

    app = "\n".join(src(n) for n in ORDER)
    with open(os.path.join(HERE, "assets", "app.js"), "w", encoding="utf-8") as f:
        f.write(app)

    css = src("styles.css")
    with open(os.path.join(HERE, "assets", "styles.css"), "w", encoding="utf-8") as f:
        f.write(css)

    charts = src("charts.js")

    # Her kaydırıcının bir başlangıç değeri olmalı. Olmadığında denetim
    # değeri undefined kalır ve grafik sessizce NaN çizer.
    for start in [m.start() for m in re.finditer(r'\{ key: "[a-z]+"', charts)]:
        depth, i = 0, start
        while i < len(charts):                     # iç içe işlevler yüzünden süslü parantez say
            if charts[i] == "{":
                depth += 1
            elif charts[i] == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        control = charts[start:i + 1]
        if "def:" not in control:
            sys.exit("başlangıç değeri (def) olmayan grafik denetimi:\n  " + " ".join(control.split()))

    # grafik kimlikleri gerçekten tanımlı mı?
    defined = set(re.findall(r'^\s{4}"([a-z0-9-]+)": \{$', charts, re.M))
    used = set()
    cdir = os.path.join(HERE, "courses")
    for name in sorted(os.listdir(cdir)):
        if not name.endswith(".json") or name == "index.json":
            continue
        c = json.load(open(os.path.join(cdir, name), encoding="utf-8"))
        for l in c["lessons"]:
            for s in l["sections"]:
                if s["kind"] == "chart":
                    used.add(s["chartId"])
    missing = used - defined
    if missing:
        sys.exit("tanımsız grafik: " + ", ".join(sorted(missing)))

    print("assets/app.js   %.1f KB" % (len(app.encode()) / 1024))
    print("assets/styles.css %.1f KB" % (len(css.encode()) / 1024))
    print("grafik: %d tanımlı, %d kullanılıyor" % (len(defined), len(used)))


if __name__ == "__main__":
    main()
