"""NBSearch IPython Magic Commands"""

from IPython.core.magic import Magics, cell_magic, magics_class
from IPython.core.display import HTML, Javascript


@magics_class
class NBSearchMagics(Magics):
    """Magic commands for NBSearch functionality"""

    @cell_magic
    def nbsearch(self, parameter_s, cell):
        """
        Cell magic for searching notebook cells using NBSearch extension.

        Usage:
            %%nbsearch
            keyword

        Parameters:
            keyword: The search term to look for in notebook cells
        """
        # Parse cell content as YAML or simple keyword
        import yaml
        import json

        try:
            # Try to parse as YAML
            parsed_query = yaml.safe_load(cell.strip())
            if isinstance(parsed_query, dict):
                query_json = json.dumps(parsed_query)
            else:
                # If YAML parsing gives a simple string, treat as _text_ query
                query_json = json.dumps({"_text_": str(parsed_query)})
        except:
            # If YAML parsing fails, treat as simple keyword for _text_ search
            query_json = json.dumps({"_text_": cell.strip()})

        # Generate JavaScript code to trigger extension search widget
        js_code = f"""
(function() {{
    const queryObj = {query_json};

    // Function to create magic search widget via extension command
    function createMagicSearchWidget() {{
        const context = window._NBSEARCH_CONTEXT;
        if (!context || !context.app) {{
            displayError('NBSearch context not found');
            return;
        }}
        const app = context.app;

        // Check if the nbsearch extension command exists
        if (!app.commands.hasCommand('nbsearch:magic-search')) {{
            displayError('NBSearch extension not found. Please make sure the nbsearch extension is installed and enabled.');
            return;
        }}

        // Execute the extension command with keyword and cell content
        app.commands.execute('nbsearch:magic-search', {{
            keyword: queryObj,
            cellHeader: '%%nbsearch {parameter_s}'.trim(),
            cellContent: `{cell}`
        }}).catch(error => {{
            console.error('Failed to execute nbsearch:magic-search command:', error);
            displayError(`Failed to create search widget: ${{error.message}}`);
        }});
    }}

    // Function to display error message
    function displayError(message) {{
        console.error('NBSearch Magic Error:', message);

        // Create a temporary message element as fallback
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; padding: 16px; border: 2px solid #d32f2f; border-radius: 8px; background: #ffebee; color: #d32f2f; font-weight: bold; max-width: 400px;';
        tempDiv.innerHTML = `❌ NBSearch Magic Error: ${{message}}`;
        document.body.appendChild(tempDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {{
            if (tempDiv.parentNode) {{
                tempDiv.parentNode.removeChild(tempDiv);
            }}
        }}, 5000);
    }}

    // Main execution
    try {{
        createMagicSearchWidget();
    }} catch (error) {{
        console.error('NBSearch Magic Error:', error);
        displayError(`Failed to create search interface: ${{error.message}}`);
    }}
}})();
"""

        # Execute the JavaScript code
        return Javascript(js_code)


def load_ipython_extension(ipython):
    """Load the NBSearch magic extension"""
    magics = NBSearchMagics(ipython)
    ipython.register_magic_function(magics.nbsearch, 'cell')


def unload_ipython_extension(ipython):
    """Unload the NBSearch magic extension"""
    # Magic commands are automatically unloaded when the extension is unloaded
    pass