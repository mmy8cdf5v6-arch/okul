#!/usr/bin/env python3
"""content/ altındaki parçaları courses/<kimlik>.json'a birleştirir.

Kullanım:  python3 content/build_course.py finans istatistik
           python3 content/build_course.py --all

Her kurs için beklenen dosyalar:
  content/<kimlik>-refs.json   künye, modüller, sözlük, isimler, çizelge,
                               grafik yerleşimi
  content/<kimlik>-a.json      ders dizisi (b, c… diye devam edebilir)

Betik parçaları birleştirir, iç tutarlılığı denetler, courses/<kimlik>.json
dosyasını ve courses/index.json girdisini yazar.
"""

import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

SECTION_FIELDS = {
    "text": {"body"},
    "list": {"title", "items"},
    "example": {"title", "body"},
    "quote": {"text", "source"},
    "formula": {"title", "expression"},
    "chart": {"chartId"},
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fail(course_id, msg):
    print("HATA [%s]: %s" % (course_id, msg), file=sys.stderr)
    sys.exit(1)


def known_charts():
    src = os.path.join(ROOT, "src", "charts.js")
    with open(src, encoding="utf-8") as f:
        return set(re.findall(r'^\s{4}"([a-z0-9-]+)": \{', f.read(), re.M))


def build(course_id, charts_available):
    refs_path = os.path.join(HERE, course_id + "-refs.json")
    if not os.path.exists(refs_path):
        fail(course_id, "başvuru dosyası yok: " + os.path.relpath(refs_path, ROOT))
    refs = load(refs_path)

    parts = sorted(glob.glob(os.path.join(HERE, course_id + "-[a-z].json")))
    if not parts:
        fail(course_id, "ders dosyası yok: content/%s-a.json bekleniyordu" % course_id)
    lessons = []
    for part in parts:
        lessons += load(part)

    module_ids = [m["id"] for m in refs["modules"]]
    lesson_ids = set()

    charts = refs.get("charts", {})
    for lesson_id in charts:
        if lesson_id not in [l["id"] for l in lessons]:
            fail(course_id, "grafik yerleşimi olmayan bir derse bakıyor: " + lesson_id)

    for lesson in lessons:
        if lesson["id"] in lesson_ids:
            fail(course_id, "yinelenen ders kimliği: " + lesson["id"])
        lesson_ids.add(lesson["id"])
        if lesson["moduleId"] not in module_ids:
            fail(course_id, "%s dersi tanımsız modüle bağlı: %s" % (lesson["id"], lesson["moduleId"]))
        if len(lesson.get("quiz", [])) < 1:
            fail(course_id, "%s dersinde soru yok" % lesson["id"])
        for q in lesson["quiz"]:
            if not 0 <= q["answerIndex"] < len(q["options"]):
                fail(course_id, "%s / %s: doğru cevap seçenek dışında" % (lesson["id"], q["id"]))
        for section in lesson["sections"]:
            need = SECTION_FIELDS.get(section["kind"])
            if need is None:
                fail(course_id, "%s: bilinmeyen bölüm türü %s" % (lesson["id"], section["kind"]))
            missing = need - set(section)
            if missing:
                fail(course_id, "%s: %s bölümünde eksik alan %s" % (lesson["id"], section["kind"], sorted(missing)))

        spot = charts.get(lesson["id"])
        if spot:
            chart_id, index = spot
            if chart_id not in charts_available:
                fail(course_id, "tanımsız grafik: " + chart_id)
            if index > len(lesson["sections"]):
                fail(course_id, "%s: grafik konumu bölüm sayısını aşıyor" % lesson["id"])
            lesson["sections"].insert(index, {"kind": "chart", "chartId": chart_id})

    lessons.sort(key=lambda l: (module_ids.index(l["moduleId"]), l["order"]))

    for name, items in (("sözlük", refs["glossary"]), ("isimler", refs["figures"])):
        for item in items:
            if item["lessonId"] not in lesson_ids:
                fail(course_id, "%s girdisi '%s' olmayan bir derse bağlı: %s"
                     % (name, item["id"], item["lessonId"]))

    figure_ids = set(f["id"] for f in refs["figures"])
    eras = refs["eraLabels"]
    for event in refs["timeline"]:
        if event["era"] not in eras:
            fail(course_id, "çizelge olayı '%s' tanımsız dönemde: %s" % (event["id"], event["era"]))
        if event.get("figureId") and event["figureId"] not in figure_ids:
            fail(course_id, "çizelge olayı '%s' olmayan bir isme bağlı" % event["id"])

    course = dict(refs["meta"])
    course["id"] = course_id
    course["modules"] = refs["modules"]
    course["lessons"] = lessons
    course["glossary"] = refs["glossary"]
    course["figures"] = refs["figures"]
    course["timeline"] = sorted(refs["timeline"], key=lambda e: e["year"])
    course["eraLabels"] = eras

    questions = sum(len(l["quiz"]) for l in lessons)
    used_charts = set()
    for lesson in lessons:
        for section in lesson["sections"]:
            if section["kind"] == "chart":
                used_charts.add(section["chartId"])

    out = os.path.join(ROOT, "courses", course_id + ".json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, separators=(",", ":"))

    entry = {
        "id": course_id,
        "title": course["title"],
        "subtitle": course["subtitle"],
        "description": course["description"],
        "icon": course["icon"],
        "accent": course["accent"],
        "accentDark": course["accentDark"],
        "category": refs["meta"].get("category", "gunumuz"),
        "lessons": len(lessons),
        "questions": questions,
        "charts": len(used_charts),
        "file": "courses/%s.json" % course_id,
    }
    print("courses/%s.json: %d ders, %d soru, %d grafik, %d terim, %d isim, %d olay (%.1f KB)" % (
        course_id, len(lessons), questions, len(used_charts), len(refs["glossary"]),
        len(refs["figures"]), len(course["timeline"]), os.path.getsize(out) / 1024))
    return entry


def main():
    argv = sys.argv[1:]
    if not argv:
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(2)
    if argv == ["--all"]:
        argv = sorted(os.path.basename(p)[: -len("-refs.json")]
                      for p in glob.glob(os.path.join(HERE, "*-refs.json")))

    charts_available = known_charts()
    index_path = os.path.join(ROOT, "courses", "index.json")
    index = load(index_path)

    for course_id in argv:
        entry = build(course_id, charts_available)
        at = next((i for i, e in enumerate(index) if e["id"] == course_id), None)
        if at is None:
            index.append(entry)
        else:
            index[at] = entry

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
