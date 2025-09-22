use dashmap::DashMap;
use log::debug;
use mimium_lang::interner::ExprNodeId;
use mimium_language_server::semantic_token::{parse, ImCompleteSemanticToken, LEGEND_TYPE};
use ropey::Rope;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::notification::Notification;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};
type SrcUri = String;

#[derive(Debug)]
struct Backend {
    client: Client,
    ast_map: DashMap<SrcUri, ExprNodeId>,
    // semantic_map: DashMap<SrcUri, Semantic>,
    document_map: DashMap<SrcUri, Rope>,
    semantic_token_map: DashMap<SrcUri, Vec<ImCompleteSemanticToken>>,
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, params: InitializeParams) -> Result<InitializeResult> {
        debug!("initialize: {:#?}", params);
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                semantic_tokens_provider: Some(
                    SemanticTokensServerCapabilities::SemanticTokensOptions(
                        SemanticTokensOptions {
                            legend: SemanticTokensLegend {
                                token_types: LEGEND_TYPE.to_vec(),
                                token_modifiers: vec![],
                            },
                            full: Some(SemanticTokensFullOptions::Bool(true)),
                            range: None,
                            work_done_progress_options: WorkDoneProgressOptions {
                                work_done_progress: None,
                            },
                        },
                    ),
                ),
                ..ServerCapabilities::default()
            },
            server_info: None,
            offset_encoding: None,
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "mimium-language-server initialized!")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    async fn semantic_tokens_full(
        &self,
        params: SemanticTokensParams,
    ) -> Result<Option<SemanticTokensResult>> {
        debug!("semantic_tokens_full: {:#?}", params);
        let uri = params.text_document.uri.to_string();
        if let Some(imcomplete_semantic_tokens) = self.semantic_token_map.get(&uri) {
            let mut last_start = 0;
            let mut last_line = 0;
            let semantic_tokens = imcomplete_semantic_tokens.iter().map(|token| {
                let line = token.start - last_start;
                let start = if line == 0 {
                    token.start - last_start
                } else {
                    token.start
                };
                last_start = token.start;
                last_line = line;
                SemanticToken {
                    delta_line: line as u32,
                    delta_start: start as u32,
                    length: token.length as u32,
                    token_type: token.token_type as u32,
                    token_modifiers_bitset: 0,
                }
            });
            Ok(Some(SemanticTokensResult::Tokens(SemanticTokens {
                result_id: None,
                data: semantic_tokens.collect(),
            })))
        } else {
            Ok(None)
        }
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        debug!("did_open: {:#?}", params);
    }
    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        debug!("did_change: {:#?}", params);
        let uri = params.text_document.uri.to_string();
        if let Some(change) = params.content_changes.into_iter().next() {
            let src = change.text;
            let rope = Rope::from_str(&src);
            self.document_map.insert(uri.clone(), rope);
            let parse_result = parse(&src, &uri);
            self.semantic_token_map
                .insert(uri.clone(), parse_result.semantic_tokens);
            self.ast_map.insert(uri, parse_result.ast);
        }
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::build(|client| Backend {
        client,
        ast_map: DashMap::new(),
        document_map: DashMap::new(),
        semantic_token_map: DashMap::new(),
    })
    .finish();

    Server::new(stdin, stdout, socket).serve(service).await;
}