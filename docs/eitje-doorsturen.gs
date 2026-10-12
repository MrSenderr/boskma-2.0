/**
 * De automatische exports van eitje doorsturen naar de app.
 *
 * Dit script draait in je eigen Google-account, niet in de app. De app kan
 * daardoor niet bij je mail; hij krijgt alleen de bestanden aangereikt die dit
 * script hem geeft.
 *
 * EENMALIG INSTELLEN
 * ------------------
 * 1. Ga naar script.google.com en open hetzelfde project als waar het script
 *    voor de facturen staat (of maak een nieuw project).
 * 2. Plak dit bestand erin, naast het bestaande script.
 * 3. Klik links op het tandwiel (Projectinstellingen) en zet onder
 *    "Scripteigenschappen" twee eigenschappen neer:
 *
 *      ROOSTER_SLEUTEL   de sleutel uit ~/rooster-sleutel.txt
 *      EITJE_AFZENDER    het adres waarvandaan eitje mailt, bijvoorbeeld
 *                        no-reply@eitje.app
 *
 * 4. Kies bovenin de functie `stuurRoostersDoor` en klik op Uitvoeren. Google
 *    vraagt eenmalig toestemming om je Gmail te lezen.
 * 5. Klik links op het klokje (Triggers) en maak er een aan: functie
 *    `stuurRoostersDoor`, tijdgestuurd, elk uur.
 *
 * Klaar. Vanaf dan gaat het vanzelf.
 */

const APP_URL = 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/rooster-inlezen';

// Verstuurde bestanden krijgen dit label. Daarmee weet het script de volgende
// ronde wat het al gedaan heeft, en gaat er niets dubbel.
const LABEL = 'naar-rooster';

function stuurRoostersDoor() {
  const props = PropertiesService.getScriptProperties();
  const sleutel = props.getProperty('ROOSTER_SLEUTEL');
  const afzender = props.getProperty('EITJE_AFZENDER');
  if (!sleutel) throw new Error('Scripteigenschap ROOSTER_SLEUTEL ontbreekt.');
  if (!afzender) throw new Error('Scripteigenschap EITJE_AFZENDER ontbreekt.');

  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  const zoek =
    'has:attachment filename:xlsx from:' + afzender + ' -label:' + LABEL + ' newer_than:60d';

  const threads = GmailApp.search(zoek, 0, 20);
  Logger.log(threads.length + ' berichten om te bekijken');

  threads.forEach(function (thread) {
    let allesGelukt = true;
    let ietsVerstuurd = false;

    thread.getMessages().forEach(function (bericht) {
      bericht.getAttachments().forEach(function (bijlage) {
        const naam = bijlage.getName();
        if (!/\.xlsx$/i.test(naam)) return;

        const antwoord = UrlFetchApp.fetch(APP_URL, {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          payload: JSON.stringify({
            sleutel: sleutel,
            bestandsnaam: naam,
            inhoud: Utilities.base64Encode(bijlage.getBytes()),
          }),
        });

        const code = antwoord.getResponseCode();
        Logger.log(naam + ' -> ' + code + ' ' + antwoord.getContentText().slice(0, 200));
        if (code >= 200 && code < 300) ietsVerstuurd = true;
        else allesGelukt = false;
      });
    });

    // Alleen labelen als alles gelukt is. Ging er iets mis, dan blijft het
    // label eraf en probeert het script het de volgende ronde opnieuw — zo
    // raak je nooit een week kwijt doordat de app even plat lag.
    if (ietsVerstuurd && allesGelukt) thread.addLabel(label);
  });
}
