importScripts('typo.js');

let dicionarioPromise = null;
const cacheCorrecoes = new Map();

function carregarDicionario() {
    if (!dicionarioPromise) {
        dicionarioPromise = (async () => {
            const baseUrl = chrome.runtime.getURL('dicts/');
            const [affResposta, dicResposta] = await Promise.all([
                fetch(`${baseUrl}pt_BR.aff`),
                fetch(`${baseUrl}pt_BR.dic`)
            ]);
            if (!affResposta.ok || !dicResposta.ok) {
                throw new Error('Não foi possível carregar o dicionário PT-BR.');
            }
            const [aff, dic] = await Promise.all([affResposta.text(), dicResposta.text()]);
            return new Typo('pt_BR', aff, dic);
        })().catch((erro) => {
            dicionarioPromise = null;
            throw erro;
        });
    }
    return dicionarioPromise;
}

function removerAcentos(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function corrigirPalavra(palavra) {
    const dicionario = await carregarDicionario();
    if (!palavra || dicionario.check(palavra)) return null;

    if (!cacheCorrecoes.has(palavra)) {
        const sugestao = dicionario.suggest(palavra).find(
            (item) => removerAcentos(item) === removerAcentos(palavra)
        ) || null;
        cacheCorrecoes.set(palavra, sugestao);
    }
    return cacheCorrecoes.get(palavra);
}

chrome.runtime.onMessage.addListener((mensagem, _sender, responder) => {
    if (mensagem?.type === 'spell-warm') {
        carregarDicionario().then(() => responder({ ready: true })).catch((erro) => {
            console.error('AutoAcento: falha ao carregar o dicionário.', erro);
            responder({ ready: false });
        });
        return true;
    }

    if (mensagem?.type === 'spell-check') {
        corrigirPalavra(mensagem.word).then((corrected) => responder({ corrected })).catch((erro) => {
            console.error('AutoAcento: falha ao consultar o dicionário.', erro);
            responder({ corrected: null });
        });
        return true;
    }
    return false;
});
