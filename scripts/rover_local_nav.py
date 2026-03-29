"""
Rover Local Perception & Navigation
====================================
2D grid cost-map tabanlı rover navigasyon simülasyonu.
Yalnızca NumPy kullanır.

Koordinat sistemi: (row, col) — yani (y, x)
"""

import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# 1. Local Window Extraction
# ─────────────────────────────────────────────────────────────────────────────

def get_local_window(cost_map: np.ndarray, position: tuple, window_size: int) -> np.ndarray:
    """
    Rover etrafındaki yerel pencereyi döndürür.

    Parameters
    ----------
    cost_map    : 2D numpy array — global maliyet haritası
    position    : (row, col) — rover'ın mevcut konumu
    window_size : yarıçap (örn. 5 → 11x11 pencere)

    Returns
    -------
    local_window : 2D numpy array (kırpılmış, sınır koşulları uygulanmış)
    """
    rows, cols = cost_map.shape
    r, c = position

    # Pencere sınırlarını hesapla, harita dışına taşmayı önle
    r_min = max(0, r - window_size)
    r_max = min(rows, r + window_size + 1)
    c_min = max(0, c - window_size)
    c_max = min(cols, c + window_size + 1)

    return cost_map[r_min:r_max, c_min:c_max].copy()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Local Obstacle Detection
# ─────────────────────────────────────────────────────────────────────────────

def detect_local_obstacle(local_window: np.ndarray, threshold: float) -> bool:
    """
    Yerel pencerede engel (yüksek maliyetli hücre) var mı kontrol eder.

    Parameters
    ----------
    local_window : get_local_window() çıktısı
    threshold    : bu değeri aşan hücre engel sayılır

    Returns
    -------
    True  → engel tespit edildi
    False → temiz pencere
    """
    return bool(np.any(local_window > threshold))


# ─────────────────────────────────────────────────────────────────────────────
# 3. Best Local Move (greedy, 4-connected)
# ─────────────────────────────────────────────────────────────────────────────

def get_best_local_move(cost_map: np.ndarray, current_pos: tuple) -> tuple:
    """
    4-bağlantılı komşular arasından en düşük maliyetli hücreyi seçer.

    Parameters
    ----------
    cost_map    : 2D numpy array
    current_pos : (row, col)

    Returns
    -------
    best_neighbor : (row, col) — en düşük maliyetli komşu
                    Hiç geçerli komşu yoksa mevcut konum döner.
    """
    rows, cols = cost_map.shape
    r, c = current_pos

    # Yukarı, aşağı, sol, sağ
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

    best_pos  = current_pos
    best_cost = np.inf

    for dr, dc in directions:
        nr, nc = r + dr, c + dc
        # Sınır kontrolü
        if 0 <= nr < rows and 0 <= nc < cols:
            cell_cost = cost_map[nr, nc]
            if cell_cost < best_cost:
                best_cost = cell_cost
                best_pos  = (nr, nc)

    return best_pos


# ─────────────────────────────────────────────────────────────────────────────
# 4. Next Step Decision
# ─────────────────────────────────────────────────────────────────────────────

def next_step_decision(
    cost_map: np.ndarray,
    global_path: list,
    current_index: int,
    current_pos: tuple,
    window_size: int = 3,
    obstacle_threshold: float = 0.7,
) -> tuple:
    """
    Bir sonraki adımı belirler:
      - Yerel pencerede engel yoksa → global yolu takip et
      - Engel varsa → yerel en iyi komşuya git

    Parameters
    ----------
    cost_map           : 2D numpy array
    global_path        : [(row, col), ...] — A* tarafından üretilmiş yol
    current_index      : global yoldaki mevcut indeks
    current_pos        : (row, col) — rover'ın anlık konumu
    window_size        : yerel pencere yarıçapı
    obstacle_threshold : engel eşiği

    Returns
    -------
    next_pos   : (row, col) — bir sonraki konum
    used_local : bool — True ise yerel hareket kullanıldı
    """
    local_window = get_local_window(cost_map, current_pos, window_size)
    obstacle_detected = detect_local_obstacle(local_window, obstacle_threshold)

    if obstacle_detected:
        # Dinamik sapma: yerel greedy hareket
        next_pos   = get_best_local_move(cost_map, current_pos)
        used_local = True
    else:
        # Global yolu takip et
        next_index = current_index + 1
        if next_index < len(global_path):
            next_pos = global_path[next_index]
        else:
            next_pos = current_pos  # Hedefe ulaşıldı
        used_local = False

    return next_pos, used_local


# ─────────────────────────────────────────────────────────────────────────────
# 5. Simulation Loop
# ─────────────────────────────────────────────────────────────────────────────

def run_simulation(
    cost_map: np.ndarray,
    global_path: list,
    start: tuple,
    goal: tuple,
    window_size: int = 3,
    obstacle_threshold: float = 0.7,
    max_steps: int = 500,
) -> list:
    """
    Rover simülasyonunu adım adım çalıştırır.

    Parameters
    ----------
    cost_map           : 2D numpy array
    global_path        : A* ile üretilmiş [(row, col), ...] listesi
    start              : (row, col) başlangıç konumu
    goal               : (row, col) hedef konum
    window_size        : yerel pencere yarıçapı
    obstacle_threshold : engel eşiği
    max_steps          : sonsuz döngü koruması

    Returns
    -------
    path_taken : rover'ın gerçekte geçtiği [(row, col), ...] listesi
    """
    current_pos   = start
    current_index = 0          # global_path içindeki mevcut indeks
    path_taken    = [current_pos]
    visited       = {current_pos}

    print(f"\n{'='*50}")
    print(f"  Simülasyon Başlıyor")
    print(f"  Start : {start}  →  Goal : {goal}")
    print(f"  Global yol uzunluğu : {len(global_path)} adım")
    print(f"  Pencere yarıçapı    : {window_size}  |  Eşik: {obstacle_threshold}")
    print(f"{'='*50}\n")

    for step in range(max_steps):
        # Hedefe ulaşıldı mı?
        if current_pos == goal:
            print(f"[Adım {step:>4}] HEDEFE ULAŞILDI: {current_pos}")
            break

        # Global yolda en yakın eşleşmeyi güncelle
        if current_index + 1 < len(global_path):
            if global_path[current_index + 1] == current_pos:
                current_index += 1

        next_pos, used_local = next_step_decision(
            cost_map,
            global_path,
            current_index,
            current_pos,
            window_size,
            obstacle_threshold,
        )

        mode = "YEREL (sapma)" if used_local else "GLOBAL"

        # Ziyaret edilmiş hücreye sıkışma koruması
        if next_pos in visited and next_pos != goal:
            # Ziyaret edilmemiş komşu arama
            rows, cols = cost_map.shape
            r, c = current_pos
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
            fallback = None
            best_cost = np.inf
            for dr, dc in directions:
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in visited:
                    if cost_map[nr, nc] < best_cost:
                        best_cost = cost_map[nr, nc]
                        fallback = (nr, nc)
            if fallback:
                next_pos = fallback
                mode = "FALLBACK (döngü kırma)"

        print(f"[Adım {step:>4}] {current_pos} → {next_pos}  [{mode}]  "
              f"maliyet={cost_map[next_pos]:.4f}")

        current_pos = next_pos
        path_taken.append(current_pos)
        visited.add(current_pos)

    else:
        print(f"\n[UYARI] Maksimum adım sayısına ({max_steps}) ulaşıldı. "
              f"Hedefe ulaşılamadı.")

    print(f"\nToplam adım : {len(path_taken) - 1}")
    print(f"Alınan yol  : {path_taken}")
    return path_taken


# ─────────────────────────────────────────────────────────────────────────────
# Demo — Basit test haritasıyla çalıştır
# ─────────────────────────────────────────────────────────────────────────────

def _simple_astar(cost_map, start, goal):
    """Basit A* implementasyonu (demo için)."""
    import heapq

    rows, cols = cost_map.shape
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {start: 0.0}

    def h(a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            return path[::-1]

        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = current[0] + dr, current[1] + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                ng = g_score[current] + cost_map[nr, nc]
                if ng < g_score.get((nr, nc), np.inf):
                    came_from[(nr, nc)] = current
                    g_score[(nr, nc)]   = ng
                    heapq.heappush(open_set, (ng + h((nr, nc), goal), (nr, nc)))
    return [start]


if __name__ == "__main__":
    np.random.seed(42)

    # 20x20 rastgele maliyet haritası (0–1 arası)
    cost_map = np.random.uniform(0.0, 0.6, size=(20, 20))

    # Ortaya yüksek maliyetli engel ekle
    cost_map[8:12, 8:12] = 0.95

    start = (0, 0)
    goal  = (19, 19)

    # A* ile global yol üret
    global_path = _simple_astar(cost_map, start, goal)

    # Simülasyonu çalıştır
    path_taken = run_simulation(
        cost_map=cost_map,
        global_path=global_path,
        start=start,
        goal=goal,
        window_size=3,
        obstacle_threshold=0.7,
        max_steps=300,
    )
