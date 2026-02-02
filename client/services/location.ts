export interface City {
    nome: string;
    uf: string;
    normalized?: string;
}

let cachedCities: City[] = [];

// Helper to remove accents/diacritics
const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const FALLBACK_CITIES: City[] = [
    { nome: "São Paulo", uf: "SP" },
    { nome: "Rio de Janeiro", uf: "RJ" },
    { nome: "Brasília", uf: "DF" },
    { nome: "Salvador", uf: "BA" },
    { nome: "Fortaleza", uf: "CE" },
    { nome: "Belo Horizonte", uf: "MG" },
    { nome: "Manaus", uf: "AM" },
    { nome: "Curitiba", uf: "PR" },
    { nome: "Recife", uf: "PE" },
    { nome: "Goiânia", uf: "GO" },
    { nome: "Belém", uf: "PA" },
    { nome: "Porto Alegre", uf: "RS" },
    { nome: "Guarulhos", uf: "SP" },
    { nome: "Campinas", uf: "SP" },
    { nome: "São Luís", uf: "MA" },
    { nome: "São Gonçalo", uf: "RJ" },
    { nome: "Maceió", uf: "AL" },
    { nome: "Duque de Caxias", uf: "RJ" },
    { nome: "Natal", uf: "RN" },
    { nome: "Teresina", uf: "PI" },
    { nome: "São Bernardo do Campo", uf: "SP" },
    { nome: "Campo Grande", uf: "MS" },
    { nome: "João Pessoa", uf: "PB" },
    { nome: "Osasco", uf: "SP" },
    { nome: "Aracaju", uf: "SE" },
].map(c => ({ ...c, normalized: c.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() }));

export const locationService = {
    async getCities(): Promise<City[]> {
        if (cachedCities.length > 0) return cachedCities;

        try {
            console.log('Fetching cities from IBGE API...');
            const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');

            if (!response.ok) {
                console.error(`IBGE API returned ${response.status}. Using fallback.`);
                return FALLBACK_CITIES;
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                console.error('IBGE API response is not an array. Using fallback.');
                return FALLBACK_CITIES;
            }

            cachedCities = data.map((item: any) => ({
                nome: item.nome,
                uf: item.microrregiao?.mesorregiao?.UF?.sigla || '??',
                normalized: normalize(item.nome)
            }));

            console.log(`Successfully indexed ${cachedCities.length} cities`);
            return cachedCities;
        } catch (error) {
            console.error("Critical error fetching cities from IBGE. Using fallback.", error);
            return FALLBACK_CITIES;
        }
    }
};
