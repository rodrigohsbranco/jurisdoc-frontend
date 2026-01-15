/**
 * Composable para conversão de números para extenso em português
 */

/**
 * Converte um valor numérico (monetário) para extenso em português
 * @param valor - Valor numérico, string ou null/undefined
 * @returns String com o valor por extenso (ex: "trezentos e dez reais e cinquenta e dois centavos")
 */
export function numeroParaExtenso(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  
  const num = typeof valor === "string" 
    ? parseFloat(valor.replace(/[^\d,.-]/g, "").replace(",", "."))
    : Number(valor);
  
  if (isNaN(num) || num === 0) return "zero";
  
  const inteiro = Math.floor(Math.abs(num));
  const centavos = Math.round((Math.abs(num) - inteiro) * 100);
  
  const unidades = [
    "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"
  ];
  
  const dezenas = [
    "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"
  ];
  
  const centenas = [
    "", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"
  ];
  
  function converterGrupo(n: number): string {
    if (n === 0) return "";
    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return dezenas[d] + (u > 0 ? " e " + unidades[u] : "");
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      if (c === 1 && resto === 0) return "cem";
      if (c === 1 && resto > 0) return "cento e " + converterGrupo(resto);
      return centenas[c] + (resto > 0 ? " e " + converterGrupo(resto) : "");
    }
    return "";
  }
  
  function converterMilhares(n: number): string {
    if (n < 1000) return converterGrupo(n);
    if (n < 1000000) {
      const mil = Math.floor(n / 1000);
      const resto = n % 1000;
      const milStr = mil === 1 ? "um mil" : converterGrupo(mil) + " mil";
      return milStr + (resto > 0 ? " " + converterGrupo(resto) : "");
    }
    if (n < 1000000000) {
      const milhao = Math.floor(n / 1000000);
      const resto = n % 1000000;
      const milhaoStr = milhao === 1 ? "um milhão" : converterGrupo(milhao) + " milhões";
      return milhaoStr + (resto > 0 ? " " + converterMilhares(resto) : "");
    }
    return "";
  }
  
  const inteiroStr = converterMilhares(inteiro);
  const centavosStr = centavos > 0 ? converterGrupo(centavos) : "";
  
  let resultado = "";
  if (inteiroStr) {
    resultado += inteiroStr;
    resultado += inteiro === 1 ? " real" : " reais";
  }
  if (centavosStr) {
    if (resultado) resultado += " e ";
    resultado += centavosStr;
    resultado += centavos === 1 ? " centavo" : " centavos";
  }
  
  return resultado || "zero";
}

/**
 * Verifica se um nome de campo é um campo "extenso"
 * @param fieldName - Nome do campo
 * @returns true se o campo contém "extenso" ou "por extenso"
 */
export function isExtensoField(fieldName: string): boolean {
  const k = fieldName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return k.includes("extenso") || k.includes("porextenso");
}

/**
 * Extrai o nome base de um campo "extenso"
 * Exemplo: "valor_parcela_extenso" -> "valor_parcela"
 * @param fieldName - Nome do campo extenso
 * @returns Nome base do campo (sem sufixos de extenso)
 */
export function getBaseFieldNameForExtenso(fieldName: string): string {
  const k = fieldName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return k
    .replace(/extenso$/g, "")
    .replace(/porextenso$/g, "")
    .replace(/_extenso$/g, "")
    .replace(/_por_extenso$/g, "")
    .replace(/por_extenso$/g, "")
    .trim();
}

/**
 * Composable que exporta as funções de conversão para extenso
 */
export function useNumeroExtenso() {
  return {
    numeroParaExtenso,
    isExtensoField,
    getBaseFieldNameForExtenso,
  };
}

