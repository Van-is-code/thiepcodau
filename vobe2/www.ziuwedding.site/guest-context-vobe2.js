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

    const targetUrl = new URL('/thiep-cuoi', window.location.href);

    if (context.guestId) targetUrl.searchParams.set('gid', context.guestId);
    if (context.guestName) targetUrl.searchParams.set('gname', context.guestName);
    if (context.invitationSlug) targetUrl.searchParams.set('inv', context.invitationSlug);

    envelope.setAttribute('href', targetUrl.toString());
    envelope.setAttribute('target', '_self');

    envelope.addEventListener('click', function (event) {
      event.preventDefault();
      window.location.href = targetUrl.toString();
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
