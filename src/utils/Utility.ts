/*
 * This file is part of NFeWizard-io.
 * 
 * NFeWizard-io is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * NFeWizard-io is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with NFeWizard-io. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'fs';
import xsdValidator from 'xsd-schema-validator';
import NFeServicosUrl from '../config/NFeServicosUrl.json';
import soapMethod from '../config/soapMethod.json';
import cStatError from '../config/cStatError.json';
import { getSchema } from './getSchema';
import Environment from '@Classes/Environment';
import { NFeWizardProps, GenericObject, SoapMethod, NFeServicosUrlType, SaveXMLProps, SaveJSONProps, ProtNFe } from '@Protocols';
import { Json } from './xml2json';
import xml2js from 'xml2js';

class Utility {
    environment;
    json: Json;
    constructor(environment: Environment) {
        this.environment = environment;
        this.json = new Json();
    }

    /**
     * Método utilitário para criar diretórios
     */
    createDir(path: string) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
    }

    /**
     * Método utilitário para escrever arquivo
     */
    createFile(path: string, fileName: string, file: any, extension: string) {
        if (extension.toLowerCase() === 'json') {
            fs.writeFileSync(`${path}/${fileName}.${extension}`, JSON.stringify(file));
        } else {
            fs.writeFileSync(`${path}/${fileName}.${extension}`, file);
        }
    }

    /**
     * Função recursiva para encontrar a chave em qualquer nivel do objeto
     */
    findInObj = (obj: GenericObject, chave: string): any => {
        if (obj.hasOwnProperty(chave)) {
            return obj[chave];
        }
        for (let prop in obj) {
            if (typeof obj[prop] === 'object') {
                const result = this.findInObj(obj[prop], chave); // Passar a chave aqui
                if (result) {
                    return result;
                }
            }
        }
        return '';
    };

    /**
     * Método responsável por gravar o XML como json
     */
    salvaJSON(props: SaveJSONProps) {
        const { fileName, metodo, path, data } = props;
        try {
            let pathJson = path;

            if (!pathJson || pathJson.trim() === '') {
                pathJson = `../tmp/${metodo}/`
            }

            // Utiliza a função recursiva para encontrar a chave chNFe
            // const chNFe = this.findInObj(json, 'chNFe');

            this.createDir(pathJson);

            this.createFile(pathJson, fileName, data, 'json');
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    /**
     * Método responsável por gravar os XML recebidos em disco
     */
    salvaXMLFromJson(config: NFeWizardProps, xmlInJson: any, fileName = "", metodo = "") {
        try {
            let pathXml = config.dfe.pathXMLRetorno;

            if (!pathXml || pathXml.trim() === '') {
                pathXml = `../tmp/${metodo}/`
            }

            const { xml } = xmlInJson;

            // Utiliza a função recursiva para encontrar a chave chNFe
            const chNFe = this.findInObj(xmlInJson, 'chNFe');

            this.createDir(pathXml);

            this.createFile(pathXml, fileName || chNFe, xml, 'xml');

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    salvaXML(props: SaveXMLProps) {
        const { fileName, metodo, path, data } = props;
        try {
            let pathXml = path;

            if (!pathXml || pathXml.trim() === '') {
                pathXml = `../tmp/${metodo}/`
            }

            // busca a chave chNFe
            // xml2js.parseString(xml, (err, result) => {
            //     if (err) {
            //         console.error('Erro ao parsear o XML para captura do chNFe:', err);
            //     } else {
            //         console.log(result);
            //     }
            // });

            this.createDir(pathXml);

            this.createFile(pathXml, fileName, data, 'xml');

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    /**
     * Recupera url para action e metoodo do SOAP
     */
    getSoapInfo(metodo: string) {
        const methodConfig = soapMethod as SoapMethod;
        const methodInfo = methodConfig[metodo];
        if (!methodInfo) {
            throw new Error("Método não encontrado no arquivo de configuração SOAP.");
        }
        return {
            method: methodInfo.method,
            action: methodInfo.action,
        };
    }

    /**
     * Define o ambiente (UF e Produção ou Homologação) para geração das chaves de recuperação da URL do webservice
     */
    setAmbiente(metodo: string, ambienteNacional = false, versao: string) {
        const config = this.environment.getConfig();
        const ambiente = config.nfe.ambiente === 2 ? 'H' : 'P';

        const versaoDF = versao !== "" ? versao : config.nfe.versaoDF;

        if (ambienteNacional) {
            const chaveMae = `NFe_AN_${ambiente}`;
            const chaveFilha = `${metodo}_${versaoDF}`;

            return { chaveMae, chaveFilha };
        }

        const chaveMae = `NFe_${config.dfe.UF}_${ambiente}`;
        const chaveFilha = `${metodo}_${versaoDF}`;

        return { chaveMae, chaveFilha };
    }

    /**
     * Retorna a url correta do webservice
     */
    getWebServiceUrl(metodo: string, ambienteNacional = false, versao = ""): string {
        const { chaveMae, chaveFilha } = this.setAmbiente(metodo, ambienteNacional, versao);
        const urls = NFeServicosUrl as NFeServicosUrlType;

        const url = urls[chaveMae] && urls[chaveMae][chaveFilha];
        if (!url) {
            throw new Error(`Não foi possível recuperar a url para o webservice: ${chaveFilha}`);
        }
        return url;
    }

    /**
     * Função para validar XML com Schema
     */

    formatErrorMessage(message: string) {
        // Esta função extrai e formata a mensagem de erro
        const regex = /\[error\]\s(.+?)\:\s(.+?)\s\((\d+):(\d+)\)/;
        const match = message.match(regex);
        if (match) {
            const [_, errorCode, errorDescription, line, column] = match;
            return `Erro na Validação do XML: ${errorCode} na linha ${line}, coluna ${column}. Descrição: ${errorDescription}`;
        } else {
            return `Erro Não Identificado na Validação do XML: ${message}`; // Retorna a mensagem original se ela não corresponder ao formato esperado
        }
    }

    validateSchema(xml: any, metodo: string) {
        return new Promise((resolve, reject) => {
            try {
                const xsdData = getSchema(metodo);

                xsdValidator.validateXML(xml, xsdData, (err, validationResult) => {
                    if (err) {
                        reject({
                            success: false,
                            message: this.formatErrorMessage(err.message),
                        });
                    } else if (!validationResult.valid) {
                        reject({
                            success: false,
                            message: this.formatErrorMessage(validationResult.messages[0]),
                        });
                    } else {
                        resolve({
                            success: true,
                            message: 'XML válido.',
                        });
                    }
                });
            } catch (error: any) {
                reject({
                    success: false,
                    message: this.formatErrorMessage(error.message),
                });
            }
        });
    }

    verificaRejeicao(data: string, metodo: string, name?: string) {
        const responseInJson = this.json.convertXmlToJson(data, metodo);

        // Gera erro em caso de Rejeição
        const xMotivo = this.findInObj(responseInJson, 'xMotivo');
        const infProt = this.findInObj(responseInJson, 'infProt');
        
        // Salva XML de retorno
        this.salvaRetorno(data, responseInJson, metodo, name);

        // Gera erro em caso de Rejeição
        if (xMotivo && (xMotivo.includes('Rejeição') || xMotivo.includes('Rejeicao'))) {
            throw new Error(xMotivo);
        }
        if (infProt && (infProt?.xMotivo.includes('Rejeição') || infProt?.xMotivo.includes('Rejeicao'))) {
            throw new Error(xMotivo);
        }
        // if (infEvento && (infEvento?.xMotivo.includes('Rejeição') || infEvento?.xMotivo.includes('Rejeicao'))) {
        //     throw new Error(xMotivo);
        // }

        return responseInJson;
    }

    getProtNFe(xmlRetorno: string): {
        protNFe: ProtNFe[] | undefined;
        nRec: string;
    } {
        let nRec = '';
        let protNFe: ProtNFe[] | undefined;
        xml2js.parseString(xmlRetorno, (err, result) => {
            if (err) {
                console.error('Erro ao parsear o XML para captura do nRec e protNFe:', err);
            } else {
                const nRecTag = this.findInObj(result, 'nRec')
                nRec = nRecTag[0]

                const protNFeTag = this.findInObj(result, 'protNFe')
                protNFe = protNFeTag
            }
        });
        return {
            protNFe,
            nRec
        };
    }

    private getRequestLogFileName(metodo: string, tipo: string) {
        switch (metodo) {
            case 'NFEStatusServico':
                return `NFeStatusServico-${tipo}`
            case 'NFEConsultaProtocolo':
                return `NFeConsultaProtocolo-${tipo}`
            case 'NFeDistribuicaoDFe':
                return `NFeDistribuicaoDFe-${tipo}`
            case 'RecepcaoEvento':
                return `RecepcaoEvento-${tipo}`
            case 'NFECancelamento':
                return `NFECancelamento-${tipo}`
            case 'NFEInutilizacao':
                return `NFEInutilizacao-${tipo}`
            case 'NFEAutorizacao':
                return `NFEAutorizacao-${tipo}`
            case 'NFERetornoAutorizacao':
                return `NFERetornoAutorizacao-${tipo}`

            default:
                throw new Error('Erro: Requisição de nome para método não implementado.')
        }
    }

    salvaConsulta(xmlConsulta: string, xmlFormated: string, metodo: string, name?: string) {
        try {
            const fileName = name || this.getRequestLogFileName(metodo, 'consulta');
            const { armazenarXMLConsulta, pathXMLConsulta, armazenarXMLConsultaComTagSoap } = this.environment.config.dfe
            const xmlConsultaASalvar = armazenarXMLConsultaComTagSoap ? xmlFormated : xmlConsulta;

            if (armazenarXMLConsulta) {
                this.salvaXML({
                    data: xmlConsultaASalvar,
                    fileName,
                    metodo,
                    path: pathXMLConsulta,
                });
            }
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    salvaRetorno(xmlRetorno: string, responseInJson: GenericObject, metodo: string, name?: string) {
        try {
            const fileName = name || this.getRequestLogFileName(metodo, 'retorno');
            const { armazenarXMLRetorno, pathXMLRetorno, armazenarRetornoEmJSON } = this.environment.config.dfe

            if (armazenarXMLRetorno) {
                this.salvaXML({
                    data: xmlRetorno,
                    fileName,
                    metodo,
                    path: pathXMLRetorno,
                });

                if (armazenarRetornoEmJSON) {
                    this.salvaJSON({
                        data: responseInJson,
                        fileName,
                        metodo,
                        path: pathXMLRetorno,
                    });
                }
            }
        } catch (error: any) {
            throw new Error(error.message)
        }
    }
}

export default Utility;