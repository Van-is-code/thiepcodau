/**
 * ============================================================
 * WEDDING DATA — BLUE BOTANICAL WATERCOLOR
 *
 * Mẫu này chạy ở HAI nơi:
 *   1. Mở trực tiếp index.html  -> dùng dữ liệu demo bên dưới.
 *   2. Nhúng trong hệ thống thiệp -> nền tảng bơm window.invitationData vào
 *      <head> TRƯỚC mọi script của mẫu. Khi đó dữ liệu demo bị thay bằng dữ
 *      liệu thật của thiệp.
 *
 * Vì sao cần cầu nối này: countdown.js, modals.js và idea4-vintage-gramophone.js
 * đọc thẳng weddingData và GHI ĐÈ lên DOM sau khi nền tảng đã bơm dữ liệu (chúng
 * là script defer nên chạy sau). Không nối thì đồng hồ đếm ngược, khối "Ngày mời"
 * và tên podcast sẽ quay về ngày cưới demo 26/04/2025.
 * ============================================================
 */

// Đọc 1 trường từ dữ liệu thật; không có thì trả về giá trị demo.
function wwPick(path, fallback) {
  var src = (typeof window !== "undefined" && window.invitationData) || null;
  if (!src) return fallback;
  var val = String(path).split(".").reduce(function (acc, k) {
    return acc == null ? acc : acc[k];
  }, src);
  if (val === undefined || val === null || val === "") return fallback;
  return val;
}

// Ghép ngày + giờ của lễ thành chuỗi ISO cho đồng hồ đếm ngược.
// ceremony_date là cột DATE đầy đủ (có giờ) nên dùng thẳng được.
function wwIsoCeremony(fallback) {
  var raw = wwPick("ceremony_date", null);
  if (!raw) return fallback;
  var d = new Date(raw);
  if (isNaN(d.getTime())) return fallback;
  // Quy ước xuyên suốt hệ thống: chữ số trong DB là giờ tường thuật -> đọc qua UTC.
  var p = function (n) { return String(n).padStart(2, "0"); };
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate())
    + "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":00";
}

const weddingData = {
  // 1. Đôi uyên ương
  couple: {
    groom: {
      fullName: wwPick("groom_name", "Trần Hoàng Nam"),
      shortName: wwPick("groom_short_name", "Hoàng Nam"),
      role: "Chú rể",
      avatar: "assets/images/couple/911e4e3e-0b3c-485f-9353-ce15b34af69b.jpg",
      description: ""
    },
    bride: {
      fullName: wwPick("bride_name", "Nguyễn Minh Anh"),
      shortName: wwPick("bride_short_name", "Minh Anh"),
      role: "Cô dâu",
      avatar: "assets/images/couple/97d061d7-b200-40c3-8ddf-13d483e29eef.jpg",
      description: ""
    },
    monogram: "M & N",
    invitationTopTag: "THE WEDDING OF",
    poeticQuote: "Cùng nhau, viết tiếp những tháng năm thật đẹp.",
    dateDisplay: wwPick("ceremony_short", "26 . 04 . 2025")
  },

  // 2. Thời gian & Đếm ngược
  eventTime: {
    dayOfWeek: wwPick("ceremony_weekday", "Thứ Bảy"),
    day: wwPick("ceremony_day", "26"),
    month: wwPick("ceremony_month", "04"),
    year: wwPick("ceremony_year", "2025"),
    time: "11:00",
    lunarDate: wwPick("ceremony_lunar_text", "Nhằm ngày 29 tháng 03 năm Ất Tỵ"),
    isoDateTime: wwIsoCeremony("2025-04-26T11:00:00+07:00"),
    countdownTarget: wwIsoCeremony("2025-04-26T11:00:00")
  },

  // 3. Địa điểm tổ chức & Bản đồ (Khớp chính xác ảnh tham chiếu)
  venue: {
    name: wwPick("venue_name", "Nhà Hàng The Luxe"),
    hall: "",
    address: wwPick("venue_address", "Số 123 Nguyễn Văn Cừ, Long Biên, Hà Nội"),
    city: wwPick("groom.address", "Long Biên · Hà Nội"),
    mapUrl: wwPick("map_url", "https://maps.google.com/?q=123+Nguyen+Van+Cu,+Long+Bien,+Ha+Noi"),
    invitationGreeting: "TRÂN TRỌNG KÍNH MỜI",
    invitationSubGreeting: "Tới dự lễ thành hôn của chúng tôi",
    heartfeltNote: "Sự hiện diện của bạn là niềm vinh hạnh lớn lao đối với chúng tôi!"
  },

  // 4. Loại thiệp & Ngày mời (Dynamic Invitation Types: MEAL_ONLY hoặc WEDDING_CEREMONY)
  invitationType: "WEDDING_CEREMONY", // Default: WEDDING_CEREMONY. Có thể chuyển bằng query param: ?type=meal hoặc ?type=ceremony

  invitationTypes: {
    MEAL_ONLY: {
      tag: "NGÀY MỜI",
      badge: "THƯ MỜI DỰ TIỆC",
      greeting: "TRÂN TRỌNG KÍNH MỜI",
      recipient: "Quý Khách",
      eventTitle: "BỮA CƠM THÂN MẬT",
      subText: "đến tham dự bữa cơm thân mật chung vui cùng gia đình chúng tôi.",
      time: wwPick("reception_time", "10:30"),
      dayOfWeek: wwPick("reception_weekday", "Thứ Bảy"),
      date: wwPick("reception_short", "26.04.2025"),
      lunarDate: wwPick("reception_lunar_text", "Nhằm ngày 29 tháng 03 năm Ất Tỵ"),
      venueName: wwPick("reception_venue_name", "Nhà Hàng The Luxe"),
      hall: "",
      address: wwPick("reception_venue_address", "Số 123 Nguyễn Văn Cừ, Long Biên, Hà Nội"),
      mapUrl: wwPick("reception_map_url", "https://maps.google.com/?q=123+Nguyen+Van+Cu,+Long+Bien,+Ha+Noi")
    },
    WEDDING_CEREMONY: {
      tag: "NGÀY MỜI",
      badge: "THƯ MỜI HÔN LỄ",
      greeting: "TRÂN TRỌNG KÍNH MỜI",
      recipient: "Quý Khách",
      eventTitle: "LỄ THÀNH HÔN",
      subText: "đến tham dự lễ thành hôn của chúng tôi.",
      time: wwPick("reception_time", "11:00"),
      dayOfWeek: wwPick("reception_weekday", "Thứ Bảy"),
      date: wwPick("reception_short", "26.04.2025"),
      lunarDate: wwPick("reception_lunar_text", "Nhằm ngày 29 tháng 03 năm Ất Tỵ"),
      venueName: wwPick("reception_venue_name", "Nhà Hàng The Luxe"),
      hall: "",
      address: wwPick("reception_venue_address", "Số 123 Nguyễn Văn Cừ, Long Biên, Hà Nội"),
      mapUrl: wwPick("reception_map_url", "https://maps.google.com/?q=123+Nguyen+Van+Cu,+Long+Bien,+Ha+Noi")
    }
  },

  // 5. Lời ngỏ
  welcome: {
    title: "Thư Mời",
    subtitle: "LỜI NGỎ",
    quote: wwPick("welcome_quote", "Ngày vui của chúng mình sẽ trọn vẹn hơn khi có sự hiện diện của bạn."),
    paragraph: "Hạnh phúc không phải là điểm đến, mà là một hành trình chúng mình cùng nhau bước đi. Chúng mình trân trọng kính mời bạn đến chung vui, sẻ chia những khoảnh khắc ý nghĩa nhất trong ngày khởi đầu tổ ấm mới."
  },

  // 5. Hai bên gia đình
  families: {
    groom: {
      sideName: "NHÀ TRAI",
      father: wwPick("groom.father_grom", "Ông: Trần Văn Thành"),
      mother: wwPick("groom.mother_groom", "Bà: Lê Thị Mai"),
      address: wwPick("groom.address", "Long Biên · Hà Nội")
    },
    bride: {
      sideName: "NHÀ GÁI",
      father: wwPick("bride.father_bride", "Ông: Nguyễn Quang Dũng"),
      mother: wwPick("bride.mother_bride", "Bà: Phạm Thu Hà"),
      address: wwPick("bride.address", "Hoàn Kiếm · Hà Nội")
    }
  },

  // 6. Timeline
  timeline: [
    {
      time: wwPick("timeline_time_1", "10:30"),
      title: wwPick("timeline_title_1", "ĐÓN KHÁCH"),
      description: "Đón tiếp quan khách, chụp hình lưu niệm tại sảnh hoa và thưởng thức welcome drink nhẹ nhàng."
    },
    {
      time: wwPick("timeline_time_2", "11:00"),
      title: wwPick("timeline_title_2", "LÀM LỄ"),
      description: "Nghi thức thành hôn thiêng liêng, trao nhẫn cưới và lời nguyện thề trăm năm dưới sự chứng kiến của người thân."
    },
    {
      time: wwPick("timeline_time_3", "11:30"),
      title: wwPick("timeline_title_3", "KHAI TIỆC"),
      description: "Thưởng thức tiệc trưa tinh tế trong không gian âm nhạc acoustic ấm áp và chúc phúc cho đôi uyên ương."
    },
    {
      time: wwPick("timeline_time_4", "12:30"),
      title: wwPick("timeline_title_4", "CHUNG VUI"),
      description: "Minigame gắn kết, chia sẻ kỷ niệm và cùng ghi lại những bức ảnh ngọt ngào trước khi tiễn khách."
    }
  ],

  // 7. Story (Optional)
  story: {
    enabled: true,
    tag: "OUR BEGINNING",
    title: "Chuyện Chúng Mình",
    quote: wwPick("story_quote", "Gặp nhau vào một chiều thu Hà Nội đầy nắng vàng, và từ đó, mọi mùa trôi qua đều có anh và em."),
    content: "Chúng mình đã đi qua những năm tháng thanh xuân cùng nhau, từ những buổi cà phê lặng lẽ góc phố cổ đến những chuyến hành trình ngắm mây xa. Hôn lễ này là lời hứa trọn đời mà cả hai cùng trân trọng gửi trao.",
    image: "assets/images/couple/591f1988-dea4-4997-8911-a862e5bd1174.jpg"
  },

  // 8. Gallery
  gallery: [
    {
      src: "assets/images/couple/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg",
      caption: "Khoảnh khắc bình yên bên nhau",
      aspect: "portrait-large"
    },
    {
      src: "assets/images/couple/2f85443c-e6a1-44a4-8bd4-43dd576fd24e.jpg",
      caption: "Nụ cười ngày chung đôi",
      aspect: "landscape"
    },
    {
      src: "assets/images/couple/45a36f75-193b-41c4-a6ba-9e071ee1870c.jpg",
      caption: "Ánh nhìn yêu thương",
      aspect: "portrait-small"
    },
    {
      src: "assets/images/couple/74807c96-05b1-406d-9baf-460cd417ab3b.jpg",
      caption: "Lời nguyện ước trăm năm",
      aspect: "portrait-tall"
    },
    {
      src: "assets/images/couple/a2115149-724b-4b3c-a583-9d44a39fd8c3.jpg",
      caption: "Nắm chặt tay nhau qua mọi giông bão",
      aspect: "square"
    }
  ],

  // 9. Lời chúc mẫu
  initialBlessings: [
    {
      name: "Phương Linh",
      relation: "Bạn thân cô dâu",
      message: "Chúc Minh Anh và Hoàng Nam luôn tràn đầy niềm vui và hạnh phúc trọn vẹn trên chặng đường mới nhé!",
      time: "Hôm qua"
    },
    {
      name: "Anh Tuấn & Thu Hương",
      relation: "Đồng nghiệp chú rể",
      message: "Mừng ngày chung đôi của đôi bạn trẻ! Chúc hai bạn trăm năm hạnh phúc, gia đình thuận hòa ấm êm.",
      time: "2 ngày trước"
    },
    {
      name: "Khánh An",
      relation: "Bạn đại học",
      message: "Thiệp cưới đẹp và tinh tế quá. Chúc hai bạn một đời an yên, cùng nhau viết tiếp câu chuyện tình yêu ngọt ngào này!",
      time: "3 ngày trước"
    }
  ],

  // 10. Mừng cưới
  gift: {
    title: "GỬI QUÀ MỪNG",
    subtitle: "HỘP MỪNG CƯỚI",
    description: "Sự hiện diện của quý khách là món quà quý giá nhất đối với chúng mình. Nếu muốn gửi quà mừng từ phương xa, quý khách có thể gửi tới tài khoản dưới đây:",
    groom: {
      title: "Mừng Cưới Chú Rể",
      bankName: wwPick("groom.bank_name", "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)"),
      accountName: wwPick("groom.bank_account_name", "TRAN HOANG NAM"),
      accountNumber: wwPick("groom.bank_account_number", "0011004567890"),
      branch: "Sở Giao Dịch Hà Nội",
      qrCode: "assets/images/qr/qr_groom.png",
      transferNote: "Mung cuoi Hoang Nam"
    },
    bride: {
      title: "Mừng Cưới Cô Dâu",
      bankName: wwPick("bride.bank_name", "Ngân hàng Quân Đội (MB Bank)"),
      accountName: wwPick("bride.bank_account_name", "NGUYEN MINH ANH"),
      accountNumber: wwPick("bride.bank_account_number", "0987654321999"),
      branch: "Chi nhánh Hoàn Kiếm",
      qrCode: "assets/images/qr/qr_bride.png",
      transferNote: "Mung cuoi Minh Anh"
    }
  },

  // 11. Nhạc nền thiệp cưới (Phát tự động xuyên suốt thiệp)
  music: {
    // Nhạc nền do chủ thiệp chọn trong kho nhạc của nền tảng (invitations.music_url).
    src: wwPick("music_url", "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=romantic-wedding-113886.mp3"),
    title: wwPick("music_title", "Romantic Wedding Piano Melodies")
  },

  // 11b. Hộp máy đĩa than độc lập (Ghi âm lời mời, lời cảm ơn hoặc bản nhạc kỷ niệm đặc biệt)
  // Khi máy đĩa than phát: Nhạc nền thiệp sẽ tự động hạ nhỏ âm lượng làm nền bên dưới
  // 11b. Wedding Podcast & Voice Note độc lập (Lời tâm tình & lời mời từ Dâu & Rể)
  // Khi máy đĩa phát: Nhạc nền thiệp sẽ tự động hạ nhỏ âm lượng làm nền (Audio Ducking)
  gramophoneAudio: {
    title: "Lời Mời & Cảm Ơn Thân Mật",
    subtitle: "Minh Anh & Hoàng Nam gửi tới bạn",
    // File âm thanh độc lập phát trên máy đĩa than (có thể là file ghi âm mp3 giọng nói hoặc nhạc kỷ niệm riêng)
    src: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=acoustic-guitar-wedding-10908.mp3",
    statusReady: "Chạm vào máy đĩa để nghe lời nhắn (Nhạc nền tự hạ nhỏ)",
    statusPlaying: "Đang phát lời nhắn của Dâu & Rể · Nhạc nền đã hạ nhỏ",
    badge: "✦ WEDDING PODCAST · LỜI TÂM TÌNH ✦",
    title: "Chuyện Chúng Mình & Lời Mời Cưới",
    subtitle: "Minh Anh & Hoàng Nam (00:46)",
    // File ghi âm podcast giọng nói dâu rể trên nền guitar mộc
    src: "assets/audio/wedding_podcast_voicenote.mp3",
    statusReady: "Chạm vào máy đĩa để nghe Podcast tâm tình (Nhạc nền tự hạ nhỏ)",
    statusPlaying: "Đang phát Voice Podcast của Dâu & Rể · Nhạc nền đã hạ nhỏ",
    statusPaused: "Tạm dừng · Chạm vào máy đĩa để nghe tiếp"
  },

  // 12. Chân trang
  footer: {
    thankYou: wwPick("footer_thank_you", "THANK YOU"),
    quote: wwPick("thank_you_message", "Cảm ơn bạn đã luôn là một phần ý nghĩa trong hành trình hạnh phúc của chúng mình."),
    signature: wwPick("bride_short_name", "Minh Anh") + " & " + wwPick("groom_short_name", "Hoàng Nam")
  }
};

// LỖI CÓ SẴN CỦA MẪU: `const weddingData` ở cấp cao nhất của script thường KHÔNG
// trở thành thuộc tính của window. countdown.js lại đọc `window.weddingData...` nên
// luôn rơi về ngày mặc định 26/04/2025 — đồng hồ đếm ngược chưa bao giờ đúng ngày
// cưới thật, kể cả khi mở mẫu độc lập. Gắn tường minh để mọi script dùng chung.
if (typeof window !== "undefined") {
  window.weddingData = weddingData;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = weddingData;
}
