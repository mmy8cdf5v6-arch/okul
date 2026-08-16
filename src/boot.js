  /* ================= başlatma ================= */
  document.getElementById("back").addEventListener("click", function () {
    if (route.screen === "kurs" && route.lesson) { go("kurs", { tab: "dersler", lesson: null }); return; }
    if (route.screen === "kurs") { leaveCourse(); return; }
    go("kutuphane");
  });

  view = document.getElementById("view");
  render();

  loadLibrary().then(function () { render(); });
})();
