#!/usr/bin/env python3
"""content/finans-*.json parçalarını courses/finans.json'a birleştirir.

Ders metinleri iki parçada (a, b), başvuru verileri (modüller, sözlük,
isimler, zaman çizelgesi, grafik yerleşimi) finans-refs.json'da tutulur.
Bu betik parçaları birleştirir, tutarlılığı denetler ve kurs dosyasını
courses/index.json girdisiyle birlikte üretir.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


def fail(msg):
    print("HATA: " + msg, file=sys.stderr)
    sys.exit(1)


def main():
    refs = load("finans-refs.json")
    lessons = load("finans-a.json") + load("finans-b.json")

    module_ids = [m["id"] for m in refs["modules"]]
    lesson_ids = set()

    # Grafik bölümlerini derslere yerleştir.
    charts = refs.get("charts", {})
    for lesson in lessons:
        if lesson["id"] in lesson_ids:
            fail("yinelenen ders kimliği: " + lesson["id"])
        lesson_ids.add(lesson["id"])
        if lesson["moduleId"] not in module_ids:
            fail("%s dersi tanımsız modüle bağlı: %s" % (lesson["id"], lesson["moduleId"]))
        spot = charts.get(lesson["id"])
        if spot:
            chart_id, index = spot
            if index > len(lesson["sections"]):
                fail("%s: grafik konumu bölüm sayısını aşıyor" % lesson["id"])
            lesson["sections"].insert(index, {"kind": "chart", "chartId": chart_id})

    # Ders sırasını modül sırası ve order alanına göre sabitle.
    lessons.sort(key=lambda l: (module_ids.index(l["moduleId"]), l["order"]))

    for name, items, field in (
        ("sözlük", refs["glossary"], "lessonId"),
        ("isimler", refs["figures"], "lessonId"),
    ):
        for item in items:
            if item[field] not in lesson_ids:
                fail("%s girdisi '%s' olmayan bir derse bağlı: %s" % (name, item["id"], item[field]))

    figure_ids = set(f["id"] for f in refs["figures"])
    eras = refs["eraLabels"]
    for event in refs["timeline"]:
        if event["era"] not in eras:
            fail("zaman çizelgesi olayı '%s' tanımsız dönemde: %s" % (event["id"], event["era"]))
        if event.get("figureId") and event["figureId"] not in figure_ids:
            fail("zaman çizelgesi olayı '%s' olmayan bir isme bağlı" % event["id"])

    timeline = sorted(refs["timeline"], key=lambda e: e["year"])

    course = dict(refs["meta"])
    course["modules"] = refs["modules"]
    course["lessons"] = lessons
    course["glossary"] = refs["glossary"]
    course["figures"] = refs["figures"]
    course["timeline"] = timeline
    course["eraLabels"] = eras

    questions = sum(len(l["quiz"]) for l in lessons)
    chart_ids = set()
    for lesson in lessons:
        for section in lesson["sections"]:
            if section["kind"] == "chart":
                chart_ids.add(section["chartId"])

    out = os.path.join(ROOT, "courses", "finans.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, separators=(",", ":"))

    # Kütüphane girdisini güncelle.
    index_path = os.path.join(ROOT, "courses", "index.json")
    with open(index_path, encoding="utf-8") as f:
        index = json.load(f)
    entry = {
        "id": course["id"],
        "title": course["title"],
        "subtitle": course["subtitle"],
        "description": course["description"],
        "icon": course["icon"],
        "accent": course["accent"],
        "accentDark": course["accentDark"],
        "lessons": len(lessons),
        "questions": questions,
        "charts": len(chart_ids),
        "file": "courses/finans.json",
    }
    index = [e for e in index if e["id"] != course["id"]] + [entry]
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("courses/finans.json: %d ders, %d soru, %d grafik, %d terim, %d isim, %d olay (%.1f KB)" % (
        len(lessons), questions, len(chart_ids), len(refs["glossary"]),
        len(refs["figures"]), len(timeline), os.path.getsize(out) / 1024))


if __name__ == "__main__":
    main()
