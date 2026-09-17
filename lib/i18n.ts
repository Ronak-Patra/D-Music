import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import bn from '../locales/bn.json';
import pa from '../locales/pa.json';
import mr from '../locales/mr.json';
import gu from '../locales/gu.json';
import ta from '../locales/ta.json';
import te from '../locales/te.json';
import kn from '../locales/kn.json';
import ml from '../locales/ml.json';
import or from '../locales/or.json';
import as from '../locales/as.json';
import ur from '../locales/ur.json';
import ne from '../locales/ne.json';
import sa from '../locales/sa.json';
import de from '../locales/de.json';
import ru from '../locales/ru.json';
import he from '../locales/he.json';
import zh from '../locales/zh.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import tr from '../locales/tr.json';
import ko from '../locales/ko.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  pa: { translation: pa },
  mr: { translation: mr },
  gu: { translation: gu },
  ta: { translation: ta },
  te: { translation: te },
  kn: { translation: kn },
  ml: { translation: ml },
  or: { translation: or },
  as: { translation: as },
  ur: { translation: ur },
  ne: { translation: ne },
  sa: { translation: sa },
  es: { translation: es },
  zh: { translation: zh },
  de: { translation: de },
  fr: { translation: fr },
  ru: { translation: ru },
  he: { translation: he },
  tr: { translation: tr },
  ko: { translation: ko },
};

// eslint-disable-next-line import/no-named-as-default-member
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
