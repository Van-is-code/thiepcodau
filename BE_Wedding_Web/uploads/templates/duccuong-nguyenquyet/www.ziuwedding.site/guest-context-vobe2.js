(function () {
  function readGuestContext() {
    const params = new URLSearchParams(window.location.search);

    const guestId = params.get('gid') || localStorage.getItem('guest_id') || '';
    const guestName = params.get('gname') || localStorage.getItem('guest_name') || '';
    const invitationSlug = params.get('inv') || localStorage.getItem('invitation_slug') || '';

    if (guestId) localStorage.setItem('guest_id', guestId);
    if (guestName) localStorage.setItem('guest_name', guestName);
    if (invitationSlug) localStorage.setItem('invitation_slug', invitationSlug);

    return { guestId, guestName, invitationSlug };
  }

  function updateInvitationText(guestName) {
    const guestHeadline = document.querySelector('#HEADLINE3 .ladi-headline');
    if (!guestHeadline) return;

    const finalGuestName = String(guestName || '').trim() || 'Quý khách';
    guestHeadline.textContent = ` ${finalGuestName}`;
  }

  function wireEnvelopeClick(context) {
    const envelope = document.getElementById('GROUP1');
    if (!envelope) return;

    // Mở phong bì = chuyển sang phongbibe2.html trong CÙNG gói mẫu. Ưu tiên báo cho
    // React host (window.parent) qua postMessage để nó tự fetch + bơm lại
    // window.invitationData vào file mới — nếu điều hướng thẳng bằng
    // window.location.href thì trình duyệt tải file gốc không có dữ liệu đã cá nhân
    // hoá. Giữ href tương đối + fallback location.href để trang vẫn chạy được khi mở
    // trực tiếp ngoài React app (vd. xem thử tĩnh).
    const targetFile = 'phongbibe2.html';
    envelope.setAttribute('href', targetFile);
    envelope.setAttribute('target', '_self');

    envelope.addEventListener('click', function (event) {
      event.preventDefault();
      // Trong iframe của React app -> báo qua postMessage để giữ được dữ liệu đã bơm.
      // Mở trực tiếp file này (không qua React app) -> điều hướng thẳng như bình thường.
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wedding-web:navigate', file: targetFile }, '*');
      } else {
        window.location.href = targetFile;
      }
    });
  }

  function conditionallyHideDecorationElements(context) {
    const line1 = document.getElementById('LINE1');
    const headline3 = document.getElementById('HEADLINE3');

    if (line1) line1.style.display = 'block';
    if (headline3) headline3.style.display = 'block';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const context = readGuestContext();
    updateInvitationText(context.guestName);
    wireEnvelopeClick(context);
    conditionallyHideDecorationElements(context);
  });
})();
