import type { PlacePhoto } from './place-photos';

// Visually reviewed 2026-11-07. Capture dates, authors and licenses were
// checked against each Commons file page; upload dates are not capture dates.
// Keep this small catalog explicit instead of randomizing unrelated article art.
const reviewed: Record<string, Omit<PlacePhoto, 'name' | 'page'>> = {
  '宇治橋': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Uji-Bridge.jpg/1280px-Uji-Bridge.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Uji-Bridge.jpg',
    credit: '京都東', license: 'CC BY-SA 4.0', capturedYear: 2023, quality: 100, bundled: 'ujiBridge', verifiedOnly: true,
  },
  '心斎橋筋商店街': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Shinsaibashi_Suji_Shopping_Street_Osaka_Japan_by_Don_Ramey_Logan.jpg/1280px-Shinsaibashi_Suji_Shopping_Street_Osaka_Japan_by_Don_Ramey_Logan.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Shinsaibashi_Suji_Shopping_Street_Osaka_Japan_by_Don_Ramey_Logan.jpg',
    credit: 'Don Ramey Logan', license: 'CC BY-SA 4.0', capturedYear: 2024, quality: 100, bundled: 'shinsaibashiArcade', verifiedOnly: true,
  },
  '二年坂': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Pedestrian_road_with_pavements_and_paper_umbrellas%2C_Higashiyama-ku%2C_Kyoto%2C_Japan%2C_early_morning.jpg/1280px-Pedestrian_road_with_pavements_and_paper_umbrellas%2C_Higashiyama-ku%2C_Kyoto%2C_Japan%2C_early_morning.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Pedestrian_road_with_pavements_and_paper_umbrellas%2C_Higashiyama-ku%2C_Kyoto%2C_Japan%2C_early_morning.jpg',
    credit: 'Basile Morin', license: 'CC BY-SA 4.0', capturedYear: 2019, quality: 100, bundled: 'ninenzaka', verifiedOnly: true,
  },
  '三年坂': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Sannenzaka-kyoto.JPG/1280px-Sannenzaka-kyoto.JPG',
    source: 'https://commons.wikimedia.org/wiki/File:Sannenzaka-kyoto.JPG',
    credit: 'Aporon999', license: 'CC BY-SA 3.0', capturedYear: 2013, quality: 100, bundled: 'sannenzaka', verifiedOnly: true,
  },
  '平等院': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/20260426_Phoenixhalle_Byodo-In-Tempel_01%2C_Uji%2C_Kyoto%2C_Japan_anagoria.jpg/1280px-20260426_Phoenixhalle_Byodo-In-Tempel_01%2C_Uji%2C_Kyoto%2C_Japan_anagoria.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:20260426_Phoenixhalle_Byodo-In-Tempel_01%2C_Uji%2C_Kyoto%2C_Japan_anagoria.jpg',
    credit: 'Anagoria', license: 'CC BY-SA 4.0', capturedYear: 2026, quality: 100, bundled: 'ujiByodoin', verifiedOnly: true,
  },
  '宇治抹茶': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/JP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_%E5%AE%87%E6%B2%BB%E5%9F%8E_Uji-shi_Uji_Myouraku_shop_Nakamura_Tokichi_Honten_Tea_House_cafe_%E7%B6%A0%E8%8C%B6%E7%94%9C%E5%93%81_Matcha_cream_June_2026_N13P_08.jpg/1280px-JP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_%E5%AE%87%E6%B2%BB%E5%9F%8E_Uji-shi_Uji_Myouraku_shop_Nakamura_Tokichi_Honten_Tea_House_cafe_%E7%B6%A0%E8%8C%B6%E7%94%9C%E5%93%81_Matcha_cream_June_2026_N13P_08.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:JP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_%E5%AE%87%E6%B2%BB%E5%9F%8E_Uji-shi_Uji_Myouraku_shop_Nakamura_Tokichi_Honten_Tea_House_cafe_%E7%B6%A0%E8%8C%B6%E7%94%9C%E5%93%81_Matcha_cream_June_2026_N13P_08.jpg',
    credit: 'HAGAT hOMSZE', license: 'CC0', capturedYear: 2026, quality: 100, bundled: 'ujiMatcha', verifiedOnly: true,
  },
  '札幌円山公園': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Maruyama_Park_2009_-_panoramio.jpg/1280px-Maruyama_Park_2009_-_panoramio.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Maruyama_Park_2009_-_panoramio.jpg',
    credit: 't-konno', license: 'CC BY-SA 3.0', quality: 100, bundled: 'maruyamaPark', verifiedOnly: true,
  },
  'サッポロビール博物館': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Sapporo_Beer_Museum.jpg/960px-Sapporo_Beer_Museum.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Sapporo_Beer_Museum.jpg',
    credit: 'MIKI Yoshihito / MrPanyGoff', license: 'CC BY 2.0', capturedYear: 2012, quality: 100, bundled: 'sapporoBeerMuseum', verifiedOnly: true,
  },
  '清水寺': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/JP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_%E6%9D%B1%E5%B1%B1%E5%8D%80_Higashiyama-ku_%E6%B8%85%E6%B0%B4%E5%AF%BA_Kiyomizu-dera_Temple_Main_Hall_n_terrace_visitors_morning_June_2026_N13P_01.jpg/960px-JP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_%E6%9D%B1%E5%B1%B1%E5%8D%80_Higashiyama-ku_%E6%B8%85%E6%B0%B4%E5%AF%BA_Kiyomizu-dera_Temple_Main_Hall_n_terrace_visitors_morning_June_2026_N13P_01.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:JP_%E6%97%A5%E6%9C%AC_Japan_%E4%BA%AC%E9%83%BD_Kyoto_%E6%9D%B1%E5%B1%B1%E5%8D%80_Higashiyama-ku_%E6%B8%85%E6%B0%B4%E5%AF%BA_Kiyomizu-dera_Temple_Main_Hall_n_terrace_visitors_morning_June_2026_N13P_01.jpg',
    credit: 'HAGAT hOMSZE', license: 'CC0', capturedYear: 2026, quality: 100, bundled: 'kiyomizuDera', verifiedOnly: true,
  },
  '伏見稲荷大社': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg/960px-Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg',
    credit: 'Basile Morin', license: 'CC BY-SA 4.0', capturedYear: 2019, quality: 100, bundled: 'fushimiInari', verifiedOnly: true,
  },
  '桜島': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/2024-08-23_Sakurajima.jpg/960px-2024-08-23_Sakurajima.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:2024-08-23_Sakurajima.jpg',
    credit: 'The Modern Polymath', license: 'CC BY-SA 4.0', capturedYear: 2024, quality: 100, bundled: 'sakurajima', verifiedOnly: true,
  },
  '首里城': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Shureimon_(Winuaijo)_Gate_of_Shuri_Castle.JPG/960px-Shureimon_(Winuaijo)_Gate_of_Shuri_Castle.JPG',
    source: 'https://commons.wikimedia.org/wiki/File:Shureimon_(Winuaijo)_Gate_of_Shuri_Castle.JPG',
    credit: 'そらみみ', license: 'CC BY-SA 4.0', capturedYear: 2015, quality: 100, bundled: 'shuriGate', verifiedOnly: true,
  },
  '太宰府天満宮': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Dazaifu_Tenman-gu_2024_September_25_various_15_05_50_967000.jpeg/960px-Dazaifu_Tenman-gu_2024_September_25_various_15_05_50_967000.jpeg',
    source: 'https://commons.wikimedia.org/wiki/File:Dazaifu_Tenman-gu_2024_September_25_various_15_05_50_967000.jpeg',
    credit: 'Nesnad', license: 'CC BY 4.0', capturedYear: 2024, quality: 100, bundled: 'dazaifuGate', verifiedOnly: true,
  },
  '鹿児島城山展望台': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/View_of_Kagoshima_and_Sakurajima_from_Shiroyama.jpg/960px-View_of_Kagoshima_and_Sakurajima_from_Shiroyama.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:View_of_Kagoshima_and_Sakurajima_from_Shiroyama.jpg',
    credit: 'Christophe95', license: 'CC BY-SA 4.0', capturedYear: 2018, quality: 100, bundled: 'shiroyama', verifiedOnly: true,
  },
  '東京スカイツリー': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Skytree2.jpg/960px-Skytree2.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Skytree2.jpg',
    credit: 'Piet Parkiet', license: 'CC BY-SA 4.0', capturedYear: 2023, quality: 100, bundled: 'skytree', verifiedOnly: true,
  },
  '北海道神宮': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/(JPN-Hokkaido)_Hokkaido_Shrine_2026-06-06.jpg/960px-(JPN-Hokkaido)_Hokkaido_Shrine_2026-06-06.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:(JPN-Hokkaido)_Hokkaido_Shrine_2026-06-06.jpg',
    credit: 'S5A-0043', license: 'CC BY 4.0', capturedYear: 2026, quality: 100, bundled: 'hokkaidoJingu', verifiedOnly: true,
  },
  '国際通り': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/202408_%E6%B2%96%E7%B9%A9%E7%B8%A3%E9%82%A3%E9%9C%B8%E5%B8%82%E7%9A%84%E9%82%A3%E9%9C%B8%E5%9C%8B%E9%9A%9B%E9%80%9A%E7%9A%84%E8%A1%97%E6%99%AF.jpg/960px-202408_%E6%B2%96%E7%B9%A9%E7%B8%A3%E9%82%A3%E9%9C%B8%E5%B8%82%E7%9A%84%E9%82%A3%E9%9C%B8%E5%9C%8B%E9%9A%9B%E9%80%9A%E7%9A%84%E8%A1%97%E6%99%AF.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:202408_%E6%B2%96%E7%B9%A9%E7%B8%A3%E9%82%A3%E9%9C%B8%E5%B8%82%E7%9A%84%E9%82%A3%E9%9C%B8%E5%9C%8B%E9%9A%9B%E9%80%9A%E7%9A%84%E8%A1%97%E6%99%AF.jpg',
    credit: 'Junyu-K', license: 'CC BY 4.0', capturedYear: 2024, quality: 100, bundled: 'kokusaiDori', verifiedOnly: true,
  },
  '第一牧志公設市場': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Naha_City_First_Makishi_Public_Market_new_building.JPG/960px-Naha_City_First_Makishi_Public_Market_new_building.JPG',
    source: 'https://commons.wikimedia.org/wiki/File:Naha_City_First_Makishi_Public_Market_new_building.JPG',
    credit: 'Abasaa', license: 'Public domain', capturedYear: 2023, quality: 100, bundled: 'makishiMarket', verifiedOnly: true,
  },
  '博多屋台': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Hakata_yatai_and_yatai_food_-_2024_Sept_24_various_11_27_44_788000.jpeg/960px-Hakata_yatai_and_yatai_food_-_2024_Sept_24_various_11_27_44_788000.jpeg',
    source: 'https://commons.wikimedia.org/wiki/File:Hakata_yatai_and_yatai_food_-_2024_Sept_24_various_11_27_44_788000.jpeg',
    credit: 'Nesnad', license: 'CC BY 4.0', capturedYear: 2024, quality: 100, bundled: 'hakataYatai', verifiedOnly: true,
  },
  '大濠公園': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/%C5%8Chori-ike_and_Ukimi-d%C5%8D_%C5%8Chori-k%C5%8Den_Ch%C5%AB%C5%8D-ku_Fukuoka_City_20221017.jpg/1280px-%C5%8Chori-ike_and_Ukimi-d%C5%8D_%C5%8Chori-k%C5%8Den_Ch%C5%AB%C5%8D-ku_Fukuoka_City_20221017.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:%C5%8Chori-ike_and_Ukimi-d%C5%8D_%C5%8Chori-k%C5%8Den_Ch%C5%AB%C5%8D-ku_Fukuoka_City_20221017.jpg',
    credit: 'Hirho', license: 'CC BY-SA 4.0', capturedYear: 2022, quality: 100, bundled: 'ohoriPark', verifiedOnly: true,
  },
  '博多ラーメン': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Hakata_ramen_bowl_closeup.jpg/960px-Hakata_ramen_bowl_closeup.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Hakata_ramen_bowl_closeup.jpg',
    credit: 'Ominae', license: 'CC BY-SA 4.0', capturedYear: 2019, quality: 100, bundled: 'hakataRamen', verifiedOnly: true,
  },
  '沖縄そば': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Okinawa_soba_noodle_%2842195524970%29.jpg/960px-Okinawa_soba_noodle_%2842195524970%29.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Okinawa_soba_noodle_%2842195524970%29.jpg',
    credit: 'pelican', license: 'CC BY-SA 2.0', capturedYear: 2018, quality: 100, bundled: 'okinawaSoba', verifiedOnly: true,
  },
  '銀座': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Ginza_Wako_20241021.jpg/960px-Ginza_Wako_20241021.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Ginza_Wako_20241021.jpg',
    credit: 'Supanut Arunoprayote', license: 'CC BY 4.0', capturedYear: 2024, quality: 100, bundled: 'ginza',
  },
  '芝公園': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Tokyo_Tower_seen_from_Shiba_Park_-_Jun_1%2C_2024.jpg/960px-Tokyo_Tower_seen_from_Shiba_Park_-_Jun_1%2C_2024.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Tokyo_Tower_seen_from_Shiba_Park_-_Jun_1,_2024.jpg',
    credit: 'Tatsuo Yamashita', license: 'CC BY 2.0', capturedYear: 2024, quality: 100, bundled: 'shibaPark',
  },
  '東京タワー': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/TokyoTower_2024.jpg/960px-TokyoTower_2024.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:TokyoTower_2024.jpg',
    credit: 'Kakidai', license: 'CC BY-SA 4.0', capturedYear: 2024, quality: 100, bundled: 'tokyoTower',
  },
  '六本木': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/September_2024%2C_buildings_around_Roppongi_20.jpg/960px-September_2024%2C_buildings_around_Roppongi_20.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:September_2024,_buildings_around_Roppongi_20.jpg',
    credit: 'Syced', license: 'CC0', capturedYear: 2024, quality: 100, bundled: 'roppongi',
  },
  '竹下通り': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Takeshita_Street.jpg/960px-Takeshita_Street.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Takeshita_Street.jpg',
    credit: 'Syced', license: 'CC0', capturedYear: 2024, quality: 100, bundled: 'takeshitaStreet',
  },
  '渋谷スクランブルスクエア': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg/960px-SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg',
    credit: 'Sakura Torch', license: 'CC BY-SA 4.0', capturedYear: 2023, quality: 100, bundled: 'shibuyaSquare',
  },
  '明治神宮': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/The_entrance_to_Meiji_Jingu%2C_Tokyo%2C_Japan.jpg/960px-The_entrance_to_Meiji_Jingu%2C_Tokyo%2C_Japan.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:The_entrance_to_Meiji_Jingu,_Tokyo,_Japan.jpg',
    credit: 'Joli Rumi', license: 'CC BY-SA 4.0', capturedYear: 2025, quality: 100, bundled: 'meiji',
  },
  '渋谷駅前交差点': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Shibuya_Crossing_in_July_2026.jpg/960px-Shibuya_Crossing_in_July_2026.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Shibuya_Crossing_in_July_2026.jpg',
    credit: 'Gatorfan252525', license: 'CC BY-SA 4.0', capturedYear: 2026, quality: 100, bundled: 'shibuya',
  },
  '道頓堀': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Osaka_Dotonbori_yoru.jpg/960px-Osaka_Dotonbori_yoru.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Osaka_Dotonbori_yoru.jpg',
    credit: 'Sakai Yayoi', license: 'CC0', capturedYear: 2026, quality: 100, bundled: 'dotonbori', verifiedOnly: true,
  },
  '大阪城公園': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Inner_moat_at_Osaka_Castle%2C_Osaka%2C_Japan.jpg/960px-Inner_moat_at_Osaka_Castle%2C_Osaka%2C_Japan.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Inner_moat_at_Osaka_Castle,_Osaka,_Japan.jpg',
    credit: 'Joli Rumi', license: 'CC BY-SA 4.0', capturedYear: 2025, quality: 100, bundled: 'osakaCastlePark',
  },
  '東京ディズニーランド': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Tokyo_Disneyland_Cinderella_Castle_%2853440904042%29.jpg/960px-Tokyo_Disneyland_Cinderella_Castle_%2853440904042%29.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Tokyo_Disneyland_Cinderella_Castle_(53440904042).jpg',
    credit: 'Dick Thomas Johnson', license: 'CC BY 2.0', capturedYear: 2023, quality: 100, bundled: 'disneyland',
  },
  '東京ディズニーシー': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Mt_Prometheus_at_Tokyo_DisneySea.jpg/960px-Mt_Prometheus_at_Tokyo_DisneySea.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Mt_Prometheus_at_Tokyo_DisneySea.jpg',
    credit: 'Louiemantia', license: 'CC BY-SA 4.0', capturedYear: 2025, quality: 100, bundled: 'disneySea',
  },
  '東京ディズニーリゾート': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Tokyo_Disney_Monorail.jpg/960px-Tokyo_Disney_Monorail.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Tokyo_Disney_Monorail.jpg',
    credit: 'J. Miers (Jtesla16)', license: 'CC BY-SA 1.0', capturedYear: 2008, quality: 100, bundled: 'disneyResort',
  },
  'ユニバーサル・スタジオ・ジャパン': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/UNIVERSAL_STUDIOS_JAPAN_GATE.jpg/960px-UNIVERSAL_STUDIOS_JAPAN_GATE.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:UNIVERSAL_STUDIOS_JAPAN_GATE.jpg',
    credit: 'Tokumeigakarinoaoshima', license: 'CC BY-SA 4.0', capturedYear: 2023, quality: 100, bundled: 'universalStudios',
  },
};
const alternateViews: typeof reviewed = {
  '心斎橋筋商店街': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Shinsaibashi-suji_Shopping_Street_20190201.jpg/1280px-Shinsaibashi-suji_Shopping_Street_20190201.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Shinsaibashi-suji_Shopping_Street_20190201.jpg',
    credit: 'そらみみ', license: 'CC BY-SA 4.0', capturedYear: 2019, quality: 100, bundled: 'shinsaibashiNight', verifiedOnly: true,
  },
  '道頓堀': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Osaka_Dotonbori_yoru_02.jpg/960px-Osaka_Dotonbori_yoru_02.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Osaka_Dotonbori_yoru_02.jpg',
    credit: 'Sakai Yayoi', license: 'CC0', capturedYear: 2026, quality: 100, bundled: 'dotonboriAlt', verifiedOnly: true,
  },
  '太宰府天満宮': {
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Dazaifu_tenmangu_shrine_temporary_main_hall.jpg/960px-Dazaifu_tenmangu_shrine_temporary_main_hall.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Dazaifu_tenmangu_shrine_temporary_main_hall.jpg',
    credit: '水だらけのプール', license: 'CC0', capturedYear: 2023, quality: 100, bundled: 'dazaifuHall', verifiedOnly: true,
  },
};
export function reviewedPlacePhoto(name: string, canonicalTitle: string): PlacePhoto | null {
  const pairedStreets = canonicalTitle === '二年坂・三年坂';
  const photo = reviewed[pairedStreets ? '二年坂' : canonicalTitle === '宇治' ? '宇治橋' : canonicalTitle];
  if (!photo) return null;
  const wikiTitles: Record<string, string> = { 鹿児島城山展望台: '城山 (鹿児島市)', 札幌円山公園: '円山公園 (札幌市)', 宇治: '宇治市', 宇治抹茶: '宇治茶', 二年坂: '二寧坂', 三年坂: '産寧坂', '二年坂・三年坂': '産寧坂' };
  const page = `https://ja.wikipedia.org/wiki/${encodeURIComponent(wikiTitles[canonicalTitle] ?? canonicalTitle)}`;
  const alternate = pairedStreets ? reviewed['三年坂'] : alternateViews[canonicalTitle];
  return { ...photo, name, page, ...(alternate ? { alternates: [{ ...alternate, name, page }] } : {}) };
}
