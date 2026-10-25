
export const formatCurrency = (value: number | undefined | null): string => {
  if (value === null || typeof value === 'undefined' || value === 0) {
    return '-';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  
  // Check if date is invalid (NaN time value)
  if (isNaN(date.getTime())) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    return '-';
  }
};

export const formatLongDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    return '-';
  }
};

const ones = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
const teens = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];
const tens = ['', 'sepuluh', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh', 'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh'];
const thousands = ['', 'ribu', 'juta', 'miliar', 'triliun'];

const convertThreeDigits = (num: number): string => {
    let str = '';
    const hundred = Math.floor(num / 100);
    const rest = num % 100;

    if (hundred > 0) {
        str += hundred === 1 ? 'seratus' : `${ones[hundred]} ratus`;
    }

    if (rest > 0) {
        str += str ? ' ' : '';
        if (rest < 10) {
            str += ones[rest];
        } else if (rest < 20) {
            str += teens[rest - 10];
        } else {
            const ten = Math.floor(rest / 10);
            const one = rest % 10;
            str += tens[ten];
            if (one > 0) {
                str += ` ${ones[one]}`;
            }
        }
    }
    return str;
};

export const numberToWords = (num: number): string => {
    if (num === 0) return 'nol';

    let words = '';
    let i = 0;

    while (num > 0) {
        if (num % 1000 !== 0) {
            let chunk = num % 1000;
            if (i > 0) {
              if(chunk === 1 && i === 1){ // handle 'seribu'
                words = 'seribu ' + words;
              } else {
                words = `${convertThreeDigits(chunk)} ${thousands[i]} ` + words;
              }
            } else {
              words = convertThreeDigits(chunk) + words;
            }
        }
        num = Math.floor(num / 1000);
        i++;
    }

    return words.trim();
};
